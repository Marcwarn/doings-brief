'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession, type Profile } from '@/lib/supabase'
import { EvaluationSubnav, InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'
import type { EvaluationQuestionType } from '@/lib/evaluations'

type CreatedPayload = {
  evaluation: {
    id: string
    token: string
    label: string
    customer: string
    questionSetId: string | null
    questionSetName: string | null
    collectEmail: boolean
    createdAt: string
    status?: 'draft' | 'active'
  }
  publicUrl: string
}

type EvaluationEditorPayload = {
  evaluation: {
    id: string
    token: string
    label: string
      customer: string
      questionSetId: string | null
      questionSetName: string | null
      collectEmail: boolean
      createdAt: string
      status?: 'draft' | 'active'
      draftData?: {
        customQuestionSetName?: string | null
        customQuestions?: Array<{
          text: string
          type: EvaluationQuestionType
        }>
        activeTab?: string | null
        followupDeliveryMode?: string | null
        activeFollowupStepId?: string | null
        followupSteps?: FollowupStepDraft[]
      } | null
    }
  questionSet: {
    id: string
    name: string
    description: string | null
  } | null
  questions: Array<{
    id: string
    text: string
    order_index: number
    type: EvaluationQuestionType
  }>
}

type EvaluationWorkspaceTab = 'setup' | 'questions' | 'publish' | 'followup'
type EvaluationDraftQuestion = {
  text: string
  type: EvaluationQuestionType
  starterKey?: string
}

type FollowupDelayPreset = 7 | 30 | 90
type FollowupStepType = 'message' | 'message_link' | 'message_questions'

type FollowupTemplateOption = {
  id: string
  name: string
  subject: string
  eyebrow: string
  headline: string
  body: string
  cta: string
}

type FollowupStepDraft = {
  id: string
  label: string
  active: boolean
  stepType: FollowupStepType
  delayDays: FollowupDelayPreset
  templateId: string
  subject: string
  eyebrow: string
  headline: string
  body: string
  cta: string
}

type FollowupDeliveryMode = 'manual' | 'automatic'

const evaluationQuestionStarters = [
  {
    id: 'reflection',
    label: 'Reflektion efter dagen',
    description: 'Korta frågor om vad deltagarna tar med sig från workshopen och vad som är viktigast att ta vidare.',
    questionSetName: 'Reflektion efter dagen',
    questions: [
      { text: 'Vad tar du framför allt med dig från dagen?', type: 'text' as const },
      { text: 'Hur relevant var innehållet för din vardag?', type: 'scale_1_5' as const },
      { text: 'Vad vill du se mer av eller fördjupa framåt?', type: 'text' as const },
    ],
  },
  {
    id: 'value',
    label: 'Värde och nästa steg',
    description: 'Passar när ni vill förstå vad som skapade mest värde och vad som bör följas upp efteråt.',
    questionSetName: 'Värde och nästa steg',
    questions: [
      { text: 'Vad var mest värdefullt för dig under workshopen?', type: 'text' as const },
      { text: 'Hur användbart känns detta för det som väntar framåt?', type: 'scale_1_5' as const },
      { text: 'Vilket nästa steg skulle göra störst skillnad nu?', type: 'text' as const },
    ],
  },
  {
    id: 'facilitation',
    label: 'Dagens upplägg',
    description: 'Passar när ni vill få återkoppling på upplägg, energi, delaktighet och facilitering.',
    questionSetName: 'Återkoppling på dagens upplägg',
    questions: [
      { text: 'Hur upplevde du dagens upplägg och tempo?', type: 'text' as const },
      { text: 'Hur väl skapade dagen utrymme för delaktighet och reflektion?', type: 'scale_1_5' as const },
      { text: 'Vad hade gjort upplevelsen ännu bättre för dig?', type: 'text' as const },
    ],
  },
] as const

const evaluationStarterQuestionBank = evaluationQuestionStarters.flatMap(starter => (
  starter.questions.map((question, index) => ({
    key: `${starter.id}-${index}`,
    starterId: starter.id,
    text: question.text,
    type: question.type,
  }))
))

const followupTemplateOptions: FollowupTemplateOption[] = [
  {
    id: 'reflection-week-1',
    name: 'Reflektion efter första veckan',
    subject: 'Hur har veckan efter utbildningen landat för dig?',
    eyebrow: 'Uppföljning efter utbildningen',
    headline: 'En kort återblick efter första veckan.',
    body: 'Vi vill gärna följa upp hur innehållet har landat i vardagen och vad som redan börjat göra skillnad. Det här mejlet ska kännas som en lugn fortsättning på utbildningen, inte som ännu ett administrativt moment.',
    cta: 'Öppna uppföljningen',
  },
  {
    id: 'action-month-1',
    name: 'Nästa steg efter en månad',
    subject: 'Vad har ni hunnit omsätta sedan utbildningen?',
    eyebrow: 'En månad senare',
    headline: 'Fånga nästa steg medan energin fortfarande finns kvar.',
    body: 'Det här utskicket passar när ni vill öppna för fortsatt rörelse efter utbildningen och hålla dialogen levande. Fokus här är inte formulärlogik, utan att skapa ett naturligt nästa steg för deltagaren.',
    cta: 'Fortsätt här',
  },
  {
    id: 'impact-quarter-1',
    name: 'Effekt efter tre månader',
    subject: 'Vad har utbildningen lett till över tid?',
    eyebrow: 'Tre månader senare',
    headline: 'Samla signaler om effekt, hållbarhet och fortsatt behov.',
    body: 'Använd det här steget för att knyta ihop utbildningen med faktisk utveckling över tid. Det ska kännas relevant och mänskligt, utan att lova en interaktion som ännu inte är bestämd i detalj.',
    cta: 'Se nästa steg',
  },
]

const initialFollowupSteps: FollowupStepDraft[] = [
  {
    id: 'step-1',
    label: 'Steg 1',
    active: false,
    stepType: 'message_questions',
    delayDays: 7,
    templateId: 'reflection-week-1',
    subject: 'Hur har veckan efter utbildningen landat för dig?',
    eyebrow: 'Uppföljning efter utbildningen',
    headline: 'En kort återblick efter första veckan.',
    body: 'Vi vill gärna följa upp hur innehållet har landat i vardagen och vad som redan börjat göra skillnad. Det här mejlet ska kännas som en lugn fortsättning på utbildningen, inte som ännu ett administrativt moment.',
    cta: 'Öppna uppföljningen',
  },
  {
    id: 'step-2',
    label: 'Steg 2',
    active: false,
    stepType: 'message_link',
    delayDays: 30,
    templateId: 'action-month-1',
    subject: 'Vad har ni hunnit omsätta sedan utbildningen?',
    eyebrow: 'En månad senare',
    headline: 'Fånga nästa steg medan energin fortfarande finns kvar.',
    body: 'Det här utskicket passar när ni vill öppna för fortsatt rörelse efter utbildningen och hålla dialogen levande. Fokus här är inte formulärlogik, utan att skapa ett naturligt nästa steg för deltagaren.',
    cta: 'Fortsätt här',
  },
  {
    id: 'step-3',
    label: 'Steg 3',
    active: false,
    stepType: 'message',
    delayDays: 90,
    templateId: 'impact-quarter-1',
    subject: 'Vad har utbildningen lett till över tid?',
    eyebrow: 'Tre månader senare',
    headline: 'Samla signaler om effekt, hållbarhet och fortsatt behov.',
    body: 'Använd det här steget för att knyta ihop utbildningen med faktisk utveckling över tid. Det ska kännas relevant och mänskligt, utan att lova en interaktion som ännu inte är bestämd i detalj.',
    cta: 'Se nästa steg',
  },
]

const followupStepTypeOptions: Array<{ value: FollowupStepType; label: string }> = [
  { value: 'message', label: 'Meddelande' },
  { value: 'message_link', label: 'Meddelande med länk' },
  { value: 'message_questions', label: 'Meddelande med frågor' },
]

function hasMeaningfulEvaluationDraft(questions: EvaluationDraftQuestion[]) {
  return questions.some(question => question.text.trim().length > 0)
}

export default function NewEvaluationPage() {
  const sb = createClient()
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'restored' | 'server-saved'>('idle')
  const [draftDirty, setDraftDirty] = useState(false)
  const [persistingDraft, setPersistingDraft] = useState(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const [editId, setEditId] = useState('')
  const [draftId, setDraftId] = useState('')
  const [customers, setCustomers] = useState<string[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [customer, setCustomer] = useState('')
  const [customQuestionSetName, setCustomQuestionSetName] = useState<string>('Utvärderingsfrågor')
  const [customQuestions, setCustomQuestions] = useState<EvaluationDraftQuestion[]>([])
  const [label, setLabel] = useState('')
  const [collectEmail, setCollectEmail] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedPayload | null>(null)
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null)
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null)
  const [activePreviewQuestionIndex, setActivePreviewQuestionIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<EvaluationWorkspaceTab>('setup')
  const [expandedStarterIds, setExpandedStarterIds] = useState<string[]>([])
  const [followupSteps, setFollowupSteps] = useState<FollowupStepDraft[]>(initialFollowupSteps)
  const [activeFollowupStepId, setActiveFollowupStepId] = useState(initialFollowupSteps[0].id)
  const [followupDeliveryMode, setFollowupDeliveryMode] = useState<FollowupDeliveryMode>('manual')

  const qrUrl = useMemo(() => (
    created ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(created.publicUrl)}` : ''
  ), [created])

  const previewQuestions = useMemo(
    () => customQuestions.filter(question => question.text.trim()),
    [customQuestions],
  )
  const previewTitle = label.trim() || 'Utvärdering efter sessionen'
  const previewCustomer = customer.trim() || 'Vald kund'
  const previewQuestionSource = customQuestionSetName.trim() || 'Utvärderingsfrågor'
  const selectedStarterKeys = useMemo(
    () => new Set(customQuestions.map(question => question.starterKey).filter(Boolean)),
    [customQuestions],
  )
  const activeFollowupStep = followupSteps.find(step => step.id === activeFollowupStepId) || followupSteps[0]
  const activeFollowupTemplate = activeFollowupStep
    ? {
        id: activeFollowupStep.templateId,
        name: followupTemplateOptions.find(template => template.id === activeFollowupStep.templateId)?.name || 'Egen mall',
        subject: activeFollowupStep.subject,
        eyebrow: activeFollowupStep.eyebrow,
        headline: activeFollowupStep.headline,
        body: activeFollowupStep.body,
        cta: activeFollowupStep.cta,
      }
    : null
  const activeFollowupStepsCount = followupSteps.filter(step => step.active).length
  const hasMeaningfulDraftState = Boolean(
    draftId
    || customer.trim()
    || label.trim()
    || hasMeaningfulEvaluationDraft(customQuestions)
    || customQuestionSetName.trim() !== 'Utvärderingsfrågor'
    || activeTab !== 'setup'
    || followupDeliveryMode !== 'manual'
    || activeFollowupStepId !== initialFollowupSteps[0].id
    || followupSteps.some((step, index) => {
      const initialStep = initialFollowupSteps[index]
      return !initialStep || JSON.stringify(step) !== JSON.stringify(initialStep)
    })
  )
  const shouldShowDraftControls = !editId && (
    Boolean(draftId)
    || draftStatus === 'restored'
    || draftStatus === 'server-saved'
    || persistingDraft
    || draftDirty
    || (hasMeaningfulDraftState && draftStatus !== 'idle')
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setEditId(params.get('edit')?.trim() || '')
    setDraftId(params.get('draft')?.trim() || '')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (editId || draftId) {
      setDraftReady(true)
      return
    }

    const saved = window.localStorage.getItem('doings:evaluation-draft:new')
    if (saved) {
      try {
        const draft = JSON.parse(saved) as {
          customer?: string
          label?: string
          collectEmail?: boolean
          customQuestionSetName?: string
          customQuestions?: EvaluationDraftQuestion[]
          activeTab?: EvaluationWorkspaceTab
          followupSteps?: FollowupStepDraft[]
          followupDeliveryMode?: FollowupDeliveryMode
          activeFollowupStepId?: string
        }

        if (typeof draft.customer === 'string') setCustomer(draft.customer)
        if (typeof draft.label === 'string') setLabel(draft.label)
        if (typeof draft.collectEmail === 'boolean') setCollectEmail(draft.collectEmail)
        if (typeof draft.customQuestionSetName === 'string') setCustomQuestionSetName(draft.customQuestionSetName)
        if (Array.isArray(draft.customQuestions) && draft.customQuestions.length > 0) setCustomQuestions(draft.customQuestions)
        if (draft.activeTab) setActiveTab(draft.activeTab)
        if (Array.isArray(draft.followupSteps) && draft.followupSteps.length > 0) setFollowupSteps(draft.followupSteps)
        if (draft.followupDeliveryMode) setFollowupDeliveryMode(draft.followupDeliveryMode)
        if (typeof draft.activeFollowupStepId === 'string') setActiveFollowupStepId(draft.activeFollowupStepId)
        setDraftStatus('restored')
      } catch {
        window.localStorage.removeItem('doings:evaluation-draft:new')
      }
    }

    setDraftReady(true)
  }, [editId, draftId])

  useEffect(() => {
    Promise.all([
      sb.auth.getUser(),
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(200),
    ]).then(async ([{ data: authData }, { data: sessionRows }]) => {
      const nextCustomers = Array.from(new Set((sessionRows || [])
        .map((session: BriefSession) => session.client_organisation?.trim() || '')
        .filter(Boolean)))

      const userId = authData.user?.id
      if (userId) {
        const { data: nextProfile } = await sb.from('profiles').select('*').eq('id', userId).single()
        setProfile(nextProfile || null)
      }

      setCustomers(nextCustomers)
      setLoading(false)
    }).catch(() => {
      setError('Kunde inte läsa grunddata för utvärderingen.')
      setLoading(false)
    })
  }, [sb])

  useEffect(() => {
    if (!editId || loading || loadedEditId === editId) return

    fetch(`/api/evaluations/${editId}`)
      .then(async response => {
        const payload = await response.json().catch(() => null) as EvaluationEditorPayload | null
        if (!response.ok || !payload) {
          throw new Error((payload as { error?: string } | null)?.error || 'Kunde inte läsa utvärderingen för redigering.')
        }

        setCustomer(payload.evaluation.customer || '')
        setLabel(payload.evaluation.label || '')
        setCollectEmail(payload.evaluation.collectEmail !== false)
        setCustomQuestionSetName(
          payload.evaluation.questionSetName
          || payload.questionSet?.name
          || 'Utvärderingsfrågor'
        )
        setCustomQuestions(
          (payload.questions || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(question => ({
              text: question.text,
              type: question.type === 'scale_1_5' ? 'scale_1_5' : 'text',
            })),
        )
        setLoadedEditId(editId)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Kunde inte läsa utvärderingen för redigering.')
      })
  }, [editId, loading, loadedEditId])

  useEffect(() => {
    if (!draftId || loading || loadedDraftId === draftId) return

    fetch(`/api/evaluations/${draftId}`)
      .then(async response => {
        const payload = await response.json().catch(() => null) as EvaluationEditorPayload | null
        if (!response.ok || !payload) {
          throw new Error((payload as { error?: string } | null)?.error || 'Kunde inte läsa utkastet.')
        }

        setCustomer(payload.evaluation.customer || '')
        setLabel(payload.evaluation.label === 'Utkast' ? '' : payload.evaluation.label || '')
        setCollectEmail(payload.evaluation.collectEmail !== false)
        setCustomQuestionSetName(
          payload.evaluation.draftData?.customQuestionSetName
          || payload.evaluation.questionSetName
          || payload.questionSet?.name
          || 'Utvärderingsfrågor'
        )
        setCustomQuestions(
          (payload.questions || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(question => ({
              text: question.text,
              type: question.type === 'scale_1_5' ? 'scale_1_5' : 'text',
            })),
        )
        if (payload.evaluation.draftData?.activeTab === 'questions' || payload.evaluation.draftData?.activeTab === 'publish' || payload.evaluation.draftData?.activeTab === 'followup') {
          setActiveTab(payload.evaluation.draftData.activeTab)
        }
        if (payload.evaluation.draftData?.followupDeliveryMode === 'automatic' || payload.evaluation.draftData?.followupDeliveryMode === 'manual') {
          setFollowupDeliveryMode(payload.evaluation.draftData.followupDeliveryMode)
        }
        if (Array.isArray(payload.evaluation.draftData?.followupSteps) && payload.evaluation.draftData.followupSteps.length > 0) {
          setFollowupSteps(payload.evaluation.draftData.followupSteps)
        }
        if (typeof payload.evaluation.draftData?.activeFollowupStepId === 'string') {
          setActiveFollowupStepId(payload.evaluation.draftData.activeFollowupStepId)
        }
        setLoadedDraftId(draftId)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Kunde inte läsa utkastet.')
      })
  }, [draftId, loading, loadedDraftId])

  useEffect(() => {
    if (!customQuestionSetName.trim() && label.trim()) {
      setCustomQuestionSetName(`${label.trim()} · utvärderingsfrågor`)
    }
  }, [label, customQuestionSetName])

  useEffect(() => {
    setActivePreviewQuestionIndex(prev => Math.min(prev, Math.max(previewQuestions.length - 1, 0)))
  }, [previewQuestions.length])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftReady || editId || created) return
    if (!hasMeaningfulDraftState && !draftId) {
      window.localStorage.removeItem('doings:evaluation-draft:new')
      setDraftDirty(false)
      setDraftStatus('idle')
      return
    }

    const draftPayload = JSON.stringify({
      customer,
      label,
      collectEmail,
      customQuestionSetName,
      customQuestions,
    activeTab,
    followupSteps,
    followupDeliveryMode,
    activeFollowupStepId,
  })

    setDraftDirty(true)
    setDraftStatus('saving')

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem('doings:evaluation-draft:new', draftPayload)
      setDraftDirty(false)
      setDraftStatus('saved')
      autosaveTimerRef.current = null
    }, 500)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [
    draftReady,
    editId,
    created,
    customer,
    label,
    collectEmail,
    customQuestionSetName,
    customQuestions,
    activeTab,
    followupSteps,
    followupDeliveryMode,
    activeFollowupStepId,
    hasMeaningfulDraftState,
    draftId,
  ])

  function resetEvaluationComposer() {
    setCustomer('')
    setLabel('')
    setCollectEmail(true)
    setCustomQuestionSetName('Utvärderingsfrågor')
    setCustomQuestions([])
    setActiveTab('setup')
    setExpandedStarterIds([])
    setActivePreviewQuestionIndex(0)
    setFollowupSteps(initialFollowupSteps)
    setActiveFollowupStepId(initialFollowupSteps[0].id)
    setFollowupDeliveryMode('manual')
    setError(null)
  }

  async function clearDraft() {
    if (typeof window === 'undefined') return
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    window.localStorage.removeItem('doings:evaluation-draft:new')
    if (draftId) {
      await fetch(`/api/evaluations/${draftId}`, { method: 'DELETE' }).catch(() => null)
      window.location.assign('/dashboard/utvardering/skapa')
      return
    }
    resetEvaluationComposer()
    setDraftDirty(false)
    setDraftStatus('idle')
  }

  async function saveDraftNow() {
    if (typeof window === 'undefined' || editId || created || persistingDraft) return
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    const draftPayload = {
      customer,
      label,
      collectEmail,
      customQuestionSetName,
      customQuestions,
      activeTab,
      followupSteps,
      followupDeliveryMode,
      activeFollowupStepId,
    }

    window.localStorage.setItem('doings:evaluation-draft:new', JSON.stringify(draftPayload))
    setPersistingDraft(true)
    setDraftStatus('saving')

    const response = await fetch(draftId ? `/api/evaluations/${draftId}` : '/api/evaluations/create', {
      method: draftId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'draft',
        customer: customer.trim(),
        label: label.trim(),
        collectEmail,
        customQuestionSetName: customQuestionSetName.trim(),
        customQuestions,
        draftData: {
          activeTab,
          followupSteps,
          followupDeliveryMode,
          activeFollowupStepId,
        },
      }),
    })
    const payload = await response.json().catch(() => null)

    setPersistingDraft(false)

    if (!response.ok) {
      setError(payload?.error || 'Kunde inte spara utkastet.')
      return
    }

    if (!draftId && payload?.evaluation?.id) {
      const nextId = String(payload.evaluation.id)
      setDraftId(nextId)
      setLoadedDraftId(nextId)
      window.history.replaceState({}, '', `/dashboard/utvardering/skapa?draft=${nextId}`)
    }

    setDraftDirty(false)
    setDraftStatus('server-saved')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [draftDirty])

  function updateCustomQuestion(index: number, value: string) {
    setCustomQuestions(prev => prev.map((question, questionIndex) => (
      questionIndex === index ? { ...question, text: value } : question
    )))
  }

  function updateCustomQuestionType(index: number, type: EvaluationQuestionType) {
    setCustomQuestions(prev => prev.map((question, questionIndex) => (
      questionIndex === index ? { ...question, type } : question
    )))
  }

  function addCustomQuestion() {
    setCustomQuestions(prev => [...prev, { text: '', type: 'text' }])
  }

  function removeCustomQuestion(index: number) {
    setCustomQuestions(prev => prev.length <= 1 ? prev : prev.filter((_, questionIndex) => questionIndex !== index))
  }

  function addStarterQuestions(starterId: string) {
    setCustomQuestions(prev => {
      const existingKeys = new Set(prev.map(question => question.starterKey).filter(Boolean))
      const additions = evaluationStarterQuestionBank
        .filter(question => question.starterId === starterId && !existingKeys.has(question.key))
        .map(question => ({ text: question.text, type: question.type, starterKey: question.key }))

      return additions.length > 0 ? [...prev, ...additions] : prev
    })
    setError(null)
  }

  function removeStarterQuestions(starterId: string) {
    const keysToRemove = new Set(
      evaluationStarterQuestionBank
        .filter(question => question.starterId === starterId)
        .map(question => question.key),
    )
    setCustomQuestions(prev => prev.filter(question => !question.starterKey || !keysToRemove.has(question.starterKey)))
    setError(null)
  }

  function toggleStarterQuestion(questionKey: string) {
    const selectedQuestion = evaluationStarterQuestionBank.find(question => question.key === questionKey)
    if (!selectedQuestion) return
    setError(null)
    setCustomQuestions(prev => {
      const exists = prev.some(question => question.starterKey === questionKey)
      if (exists) {
        return prev.filter(question => question.starterKey !== questionKey)
      }

      return [
        ...prev,
        { text: selectedQuestion.text, type: selectedQuestion.type, starterKey: selectedQuestion.key },
      ]
    })
  }

  function addAllStarterQuestions() {
    setCustomQuestions(prev => {
      const existingKeys = new Set(prev.map(question => question.starterKey).filter(Boolean))
      const additions = evaluationStarterQuestionBank
        .filter(question => !existingKeys.has(question.key))
        .map(question => ({ text: question.text, type: question.type, starterKey: question.key }))

      return additions.length > 0 ? [...prev, ...additions] : prev
    })
    setError(null)
  }

  function clearStarterQuestions() {
    setCustomQuestions(prev => prev.filter(question => !question.starterKey))
    setError(null)
  }

  function updateFollowupStep(stepId: string, patch: Partial<FollowupStepDraft>) {
    setFollowupSteps(prev => prev.map(step => (
      step.id === stepId ? { ...step, ...patch } : step
    )))
  }

  function applyFollowupTemplate(stepId: string, templateId: string) {
    const template = followupTemplateOptions.find(item => item.id === templateId)
    if (!template) return

    updateFollowupStep(stepId, {
      templateId,
      subject: template.subject,
      eyebrow: template.eyebrow,
      headline: template.headline,
      body: template.body,
      cta: template.cta,
      active: true,
    })
  }

  async function createEvaluation(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const filteredCustomQuestions = customQuestions
      .map(item => ({ text: item.text.trim(), type: item.type }))
      .filter(item => item.text)

    if (!customer.trim() || !label.trim()) {
      setError('Fyll i kund och namn på tillfälle.')
      return
    }

    if (!customQuestionSetName.trim()) {
      setError('Ge frågorna ett namn innan du skapar utvärderingen.')
      return
    }

    if (filteredCustomQuestions.length === 0) {
      setError('Lägg till minst en fråga i utvärderingen.')
      return
    }

    setSaving(true)
    const targetId = editId || draftId
    const response = await fetch(targetId ? `/api/evaluations/${targetId}` : '/api/evaluations/create', {
      method: targetId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'active',
        customer: customer.trim(),
        questionSetId: '',
        label: label.trim(),
        collectEmail,
        customQuestionSetName: customQuestionSetName.trim(),
        customQuestions: filteredCustomQuestions,
        draftData: {
          activeTab,
          followupSteps,
          followupDeliveryMode,
          activeFollowupStepId,
        },
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error || (editId ? 'Kunde inte spara utvärderingen.' : 'Kunde inte skapa utvärderingen.'))
      setSaving(false)
      return
    }

    clearDraft()
    setCreated(payload)
    setSaving(false)
  }

  async function downloadQrPng() {
    if (!created || !qrUrl) return

    const response = await fetch(qrUrl)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `${slugify(created.evaluation.label)}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  if (loading) return <PageLoader />

  return (
    <div style={pageShellStyle}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
          {editId ? 'Redigera utvärdering' : draftId ? 'Fortsätt utkast' : 'Skapa utvärdering'}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, maxWidth: 700 }}>
          {editId
            ? 'Justera kund, frågor och upplägg för den här utvärderingen och spara tillbaka ändringarna.'
            : draftId
            ? 'Det här utkastet är sparat i systemet och kan fortsättas härifrån.'
            : 'Välj kund först, sätt sedan frågor och publicera en publik länk med QR-kod för deltagarna.'}
        </p>
        {shouldShowDraftControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              {draftStatus === 'restored'
                ? 'Ett tidigare utkast återställdes när sidan öppnades.'
                : draftStatus === 'saving'
                ? 'Sparar dina senaste ändringar…'
                : draftStatus === 'server-saved'
                ? 'Utkastet är sparat i systemet.'
                : draftStatus === 'saved'
                ? 'Dina senaste ändringar finns sparade lokalt.'
                : draftId
                ? 'Du arbetar i ett sparat utkast.'
                : 'Dina ändringar sparas automatiskt medan du arbetar.'}
            </div>
            <button type="button" onClick={() => void saveDraftNow()} disabled={persistingDraft} style={ghostButtonStyle}>
              {persistingDraft ? 'Sparar…' : 'Spara som utkast'}
            </button>
            <button type="button" onClick={() => void clearDraft()} style={ghostButtonStyle}>
              Börja om
            </button>
          </div>
        )}
      </div>

      <EvaluationSubnav active="new" />

      {error && <InlineError text={error} />}

      <div style={evaluationStatsRowStyle}>
        <EvaluationStatCard
          label="Frågor"
          value={`${previewQuestions.length}`}
          text={previewQuestions.length === 1 ? 'fråga i utvärderingen' : 'frågor i utvärderingen'}
        />
        <EvaluationStatCard
          label="Kund"
          value={previewCustomer}
          text={customer.trim() ? 'kopplad till utvärderingen' : 'välj först i flödet'}
        />
        <EvaluationStatCard
          label="Insamling"
          value={collectEmail ? 'Med e-post' : 'Anonym'}
          text={collectEmail ? 'deltagaren identifierar sig sist' : 'svar skickas utan identitet'}
        />
      </div>

      <div style={workspaceStyle}>
        <form onSubmit={createEvaluation} style={editorPanelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'setup' as const, label: 'Upplägg' },
                { key: 'questions' as const, label: 'Frågor' },
                { key: 'publish' as const, label: 'Publicera' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    ...workspaceTabButtonStyle,
                    color: activeTab === tab.key ? 'var(--text)' : 'var(--text-2)',
                    background: activeTab === tab.key ? 'rgba(14,14,12,0.06)' : 'rgba(255,255,255,0.88)',
                    borderColor: activeTab === tab.key ? 'rgba(14,14,12,0.12)' : 'var(--border)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('followup')}
              style={{
                ...followupLaunchButtonStyle,
                color: activeTab === 'followup' ? '#fff' : 'var(--text)',
                background: activeTab === 'followup'
                  ? 'linear-gradient(135deg, #151312 0%, #2a2523 100%)'
                  : 'rgba(255,255,255,0.92)',
                borderColor: activeTab === 'followup' ? 'rgba(21,19,18,0.4)' : 'rgba(14,14,12,0.08)',
              }}
            >
              Uppföljning
            </button>
          </div>

          {activeTab === 'questions' && (
          <Field label="Utvärderingsfrågor">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Välj ett upplägg för dagens utvärdering</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Öppna ett block och välj hela blocket eller enskilda frågor. Du kan kombinera fritt mellan alla nio frågor.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {evaluationQuestionStarters.map(item => {
                    const starterQuestions = evaluationStarterQuestionBank.filter(question => question.starterId === item.id)
                    const selectedCount = starterQuestions.filter(question => selectedStarterKeys.has(question.key)).length
                    const allSelected = selectedCount === starterQuestions.length
                    const expanded = expandedStarterIds.includes(item.id)
                    return (
                      <div key={item.id} style={{
                        display: 'grid',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${allSelected ? 'rgba(198,35,104,0.32)' : 'var(--border)'}`,
                        background: allSelected ? 'rgba(198,35,104,0.05)' : 'var(--surface)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, marginTop: 2 }}>{item.description}</div>
                          </div>
                          <div style={{
                            flexShrink: 0,
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: selectedCount > 0 ? 'rgba(198,35,104,0.10)' : 'rgba(14,14,12,0.05)',
                            color: selectedCount > 0 ? 'var(--accent)' : 'var(--text-3)',
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {selectedCount === 0 ? 'Inga valda' : `${selectedCount} av ${starterQuestions.length} valda`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedStarterIds(prev => (
                              prev.includes(item.id)
                                ? prev.filter(id => id !== item.id)
                                : [...prev, item.id]
                            ))}
                            style={ghostButtonStyle}
                          >
                            {expanded ? 'Dölj frågor' : 'Öppna frågor'}
                          </button>
                        </div>
                        {expanded && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => allSelected ? removeStarterQuestions(item.id) : addStarterQuestions(item.id)} style={ghostButtonStyle}>
                                {allSelected ? 'Avmarkera hela blocket' : `Välj hela blocket (${starterQuestions.length})`}
                              </button>
                              {selectedCount > 0 && !allSelected && (
                                <button type="button" onClick={() => removeStarterQuestions(item.id)} style={ghostButtonStyle}>
                                  Avmarkera blocket
                                </button>
                              )}
                            </div>
                            {starterQuestions.map(question => {
                              const selected = selectedStarterKeys.has(question.key)
                              return (
                                <label
                                  key={question.key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '11px 12px',
                                    borderRadius: 10,
                                    border: `1px solid ${selected ? 'rgba(198,35,104,0.26)' : 'var(--border)'}`,
                                    background: selected ? 'rgba(198,35,104,0.08)' : 'rgba(255,255,255,0.9)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleStarterQuestion(question.key)}
                                      style={{ marginTop: 2 }}
                                    />
                                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>
                                      {question.text}
                                    </div>
                                  </div>
                                  <div style={{
                                    flexShrink: 0,
                                    padding: '5px 8px',
                                    borderRadius: 999,
                                    background: selected ? 'rgba(198,35,104,0.12)' : 'rgba(14,14,12,0.05)',
                                    color: selected ? 'var(--accent)' : 'var(--text-3)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                  }}>
                                    {question.type === 'scale_1_5' ? 'Skala' : 'Fritext'}
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Namn på frågorna">
                  <input
                    value={customQuestionSetName}
                    onChange={e => setCustomQuestionSetName(e.target.value)}
                    placeholder="Till exempel Reflektion efter dagen"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>Frågor till deltagarna</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={addCustomQuestion} style={ghostButtonStyle}>
                      Lägg till fråga
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customQuestions.map((question, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          rows={2}
                          value={question.text}
                          onChange={e => updateCustomQuestion(index, e.target.value)}
                          placeholder={`Fråga ${index + 1}`}
                          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                        />
                        <select
                          value={question.type}
                          onChange={e => updateCustomQuestionType(index, e.target.value === 'scale_1_5' ? 'scale_1_5' : 'text')}
                          style={inputStyle}
                        >
                          <option value="text">Fritext</option>
                          <option value="scale_1_5">Skala 1–5</option>
                        </select>
                      </div>
                      <button type="button" onClick={() => removeCustomQuestion(index)} style={smallDeleteStyle}>
                        Ta bort
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Field>
          )}

          {activeTab === 'setup' && (
            <>
          <div style={{ display: 'grid', gap: 6, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Kund och tillfälle
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
              Börja med att välja kund och ge tillfället ett tydligt namn. Därefter kan du sätta frågorna och publicera länken.
            </div>
          </div>
          <Field label="Kund">
            <>
              <input
                list="evaluation-customers"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Till exempel Mojang"
                style={inputStyle}
              />
              <datalist id="evaluation-customers">
                {customers.map(item => <option key={item} value={item} />)}
              </datalist>
            </>
          </Field>

          <Field label="Namn på tillfälle">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ledarutbildning Malmö 27 mars"
              style={inputStyle}
            />
          </Field>

          {profile?.role === 'admin' && (
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              <input
                type="checkbox"
                checked={collectEmail}
                onChange={e => setCollectEmail(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Samla in deltagarnas e-post sist
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  Stäng av om utvärderingen ska vara helt anonym.
                </div>
              </div>
            </label>
          )}
            </>
          )}

          {activeTab === 'publish' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={subtlePanelStyle}>
                <div style={{ ...eyebrowLabelStyle, marginBottom: 8 }}>
                  Publicering
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                  {editId
                    ? 'När du sparar uppdateras den befintliga publika länken och QR-koden fortsätter att peka på samma utvärdering.'
                    : 'När du skapar utvärderingen genereras en publik länk och QR-kod här i publiceringssteget. Därifrån kan du kopiera länken, ladda ner QR-koden och öppna uppföljningen.'}
                </div>
              </div>

              <div style={{ ...subtlePanelStyle, display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Kontrollera frågorna och previewn först. Publiceringen använder exakt det upplägg du ser till höger.
                </div>
                <button type="submit" disabled={saving} style={submitButtonStyle(saving)}>
                  {saving ? (editId ? 'Sparar…' : 'Skapar…') : (editId ? 'Spara ändringar' : 'Skapa länk och QR')}
                </button>
              </div>

              {created && (
                <EvaluationPublishCard created={created} qrUrl={qrUrl} onDownloadQr={() => void downloadQrPng()} />
              )}
            </div>
          )}

          {activeTab === 'followup' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={subtlePanelStyle}>
                <div style={{ ...eyebrowLabelStyle, marginBottom: 8 }}>
                  Mottagare
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
                    Deltagare som svarar med e-post kan få uppföljning efter utbildningen. Det här är frivilligt. Du kan lämna uppföljningen tom och ändå publicera utvärderingen.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    <MiniInfoCard label="Kund" value={previewCustomer} />
                    <MiniInfoCard label="Utbildning" value={previewQuestionSource} />
                    <MiniInfoCard label="Svarsläge" value={collectEmail ? 'Med e-post' : 'Anonymt'} />
                  </div>
                </div>
              </div>

              {activeFollowupStepsCount === 0 ? (
                <div style={{ ...subtlePanelStyle, display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ ...eyebrowLabelStyle, marginBottom: 8 }}>
                      Uppföljning
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65 }}>
                      Vill du följa upp deltagarna med mejl efter utbildningen kan du lägga till steg här. Om inte, lämnar du bara detta tomt.
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    Du kan börja med ett enda steg och bygga vidare senare.
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        updateFollowupStep('step-1', { active: true })
                        setActiveFollowupStepId('step-1')
                      }}
                      style={followupPrimaryButtonStyle}
                    >
                      Lägg till uppföljning
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ ...subtlePanelStyle, display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ ...eyebrowLabelStyle, marginBottom: 8 }}>
                      Steg
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                      Håll det kort och tydligt. Välj när utskicket ska gå och vilken mall som ska användas. Du kan aktivera upp till tre steg.
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: '1px solid rgba(14,14,12,0.08)',
                    background: 'rgba(255,255,255,0.78)',
                  }}>
                    <div style={tinyLabelStyle}>Hur ska uppföljningen skickas?</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        {
                          key: 'manual' as const,
                          label: 'Skicka manuellt',
                          description: 'Konsulten bestämmer när varje steg går ut.',
                        },
                        {
                          key: 'automatic' as const,
                          label: 'Skicka automatiskt',
                          description: 'Systemet skickar stegen enligt den tidsplan du ställer in.',
                        },
                      ].map(option => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setFollowupDeliveryMode(option.key)}
                          style={{
                            ...deliveryModeButtonStyle,
                            background: followupDeliveryMode === option.key ? 'rgba(198,35,104,0.08)' : 'rgba(255,255,255,0.9)',
                            borderColor: followupDeliveryMode === option.key ? 'rgba(198,35,104,0.26)' : 'rgba(14,14,12,0.08)',
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{option.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 4 }}>
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                      {followupDeliveryMode === 'automatic'
                        ? 'Automatiskt läge ska senare använda tidsplanen för att skicka utan manuellt handpålägg. Loggen behöver då tydligt visa vad som gått iväg av sig självt.'
                        : 'Manuellt läge passar när konsulten vill tajma varje steg själv eller invänta rätt läge efter utbildningen.'}
                    </div>
                  </div>

                  {followupDeliveryMode === 'automatic' && (
                    <div style={automaticModeNoticeStyle}>
                      <div style={{ ...eyebrowLabelStyle, marginBottom: 8, color: '#7c2d12' }}>
                        Automatiskt läge
                      </div>
                      <div style={{ fontSize: 13.5, color: '#7c2d12', lineHeight: 1.65 }}>
                        När detta läge byggs klart ska systemet själv skicka aktiva steg enligt din tidsplan. För konsulten behöver det därför bli tydligt vad som är planerat, vad som redan har gått ut och om något behöver pausas.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 10 }}>
                    {followupSteps.map(step => {
                      const selected = step.id === activeFollowupStepId
                      const resolvedTemplate = followupTemplateOptions.find(template => template.id === step.templateId)
                      const resolvedType = followupStepTypeOptions.find(option => option.value === step.stepType)?.label || 'Meddelande'
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setActiveFollowupStepId(step.id)}
                          style={{
                            ...followupStepCardStyle,
                            borderColor: selected ? 'rgba(198,35,104,0.28)' : 'rgba(14,14,12,0.08)',
                            background: selected ? 'rgba(198,35,104,0.06)' : 'rgba(255,255,255,0.86)',
                            opacity: step.active ? 1 : 0.72,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{step.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                            {step.active ? `Skickas ${step.delayDays} dagar efter utbildningen` : 'Inte aktiverat ännu'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                            {resolvedType}
                              </div>
                            </div>
                            <span style={{
                              ...followupStatusPillStyle,
                              background: step.active ? 'rgba(198,35,104,0.1)' : 'rgba(14,14,12,0.06)',
                              color: step.active ? 'var(--accent)' : 'var(--text-3)',
                            }}>
                              {step.active ? 'Aktivt' : 'Av'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                            <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                              <span style={tinyLabelStyle}>Typ</span>
                              <select
                                value={step.stepType}
                                onChange={event => updateFollowupStep(step.id, {
                                  stepType: event.target.value as FollowupStepType,
                                  active: true,
                                })}
                                style={compactInputStyle}
                              >
                                {followupStepTypeOptions.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>

                            <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                              <span style={tinyLabelStyle}>Skickas efter</span>
                              <select
                                value={step.delayDays}
                                onChange={event => updateFollowupStep(step.id, {
                                  delayDays: Number(event.target.value) as FollowupDelayPreset,
                                  active: true,
                                })}
                                style={compactInputStyle}
                              >
                                <option value={7}>7 dagar</option>
                                <option value={30}>30 dagar</option>
                                <option value={90}>90 dagar</option>
                              </select>
                            </label>

                            <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                              <span style={tinyLabelStyle}>Mall</span>
                              <select
                                value={step.templateId}
                                onChange={event => applyFollowupTemplate(step.id, event.target.value)}
                                style={compactInputStyle}
                              >
                                {followupTemplateOptions.map(template => (
                                  <option key={template.id} value={template.id}>{template.name}</option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                              {resolvedTemplate ? resolvedTemplate.name : 'Ingen mall vald'}
                            </div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
                              <input
                                type="checkbox"
                                checked={step.active}
                                onChange={event => updateFollowupStep(step.id, { active: event.target.checked })}
                              />
                              Aktivt steg
                            </label>
                          </div>

                          {selected && (
                            <div style={{ display: 'grid', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(14,14,12,0.08)' }}>
                              <div style={tinyLabelStyle}>Innehåll i mejlet</div>

                              <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                <span style={tinyLabelStyle}>Ämnesrad</span>
                                <input
                                  value={step.subject}
                                  onChange={event => updateFollowupStep(step.id, { subject: event.target.value, active: true })}
                                  style={compactInputStyle}
                                />
                              </label>

                              <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                <span style={tinyLabelStyle}>Liten rubrik</span>
                                <input
                                  value={step.eyebrow}
                                  onChange={event => updateFollowupStep(step.id, { eyebrow: event.target.value, active: true })}
                                  style={compactInputStyle}
                                />
                              </label>

                              <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                <span style={tinyLabelStyle}>Rubrik</span>
                                <input
                                  value={step.headline}
                                  onChange={event => updateFollowupStep(step.id, { headline: event.target.value, active: true })}
                                  style={compactInputStyle}
                                />
                              </label>

                              <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                <span style={tinyLabelStyle}>Brödtext</span>
                                <textarea
                                  value={step.body}
                                  onChange={event => updateFollowupStep(step.id, { body: event.target.value, active: true })}
                                  rows={5}
                                  style={{ ...compactInputStyle, minHeight: 120, resize: 'vertical' }}
                                />
                              </label>

                              <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
                                <span style={tinyLabelStyle}>Knapptext</span>
                                <input
                                  value={step.cta}
                                  onChange={event => updateFollowupStep(step.id, { cta: event.target.value, active: true })}
                                  style={compactInputStyle}
                                />
                              </label>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ ...subtlePanelStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...eyebrowLabelStyle, marginBottom: 2 }}>
                  Överblick
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65 }}>
                  {activeFollowupStepsCount === 0
                    ? 'Ingen uppföljning är aktiv ännu.'
                    : `${activeFollowupStepsCount} steg planerade. Första aktiva steg går ${Math.min(...followupSteps.filter(step => step.active).map(step => step.delayDays))} dagar efter utbildningen.`}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  {followupDeliveryMode === 'automatic'
                    ? 'Automatiskt läge ska senare kunna skicka enligt plan och sedan visa exakt vad som har gått ut och till vilka, utan att du behöver lämna utvärderingen.'
                    : 'När sender.net-kopplingen är fullt inkopplad ska samma yta även visa vad som har skickats och till vilka, utan att du behöver lämna utvärderingen.'}
                </div>
              </div>
            </div>
          )}
        </form>

        <aside style={previewRailStyle}>
          <div style={previewRailInnerStyle}>
            {activeTab === 'followup' ? (
              <EvaluationFollowupPreviewCard
                customer={previewCustomer}
                training={previewTitle}
                step={activeFollowupStep}
                template={activeFollowupTemplate}
              />
            ) : (
              <EvaluationPreviewCard
                title={previewTitle}
                customer={previewCustomer}
                questionSource={previewQuestionSource}
                collectEmail={collectEmail}
                questions={previewQuestions}
                activeQuestionIndex={activePreviewQuestionIndex}
                onSelectQuestion={setActivePreviewQuestionIndex}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function EvaluationStatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div style={{ ...subtlePanelStyle, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, lineHeight: 1.15, color: 'var(--text)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  )
}

function EvaluationPreviewCard({
  title,
  customer,
  questionSource,
  collectEmail,
  questions,
  activeQuestionIndex,
  onSelectQuestion,
}: {
  title: string
  customer: string
  questionSource: string
  collectEmail: boolean
  questions: Array<{ text: string; type: EvaluationQuestionType }>
  activeQuestionIndex: number
  onSelectQuestion: (index: number) => void
}) {
  const activeQuestion = questions[activeQuestionIndex] || null
  const resolvedTitle = title.trim() || 'Reflektion efter workshoppen'
  const resolvedCustomer = customer.trim() || 'Ingen kund vald ännu'
  const progressWidth = questions.length > 0
    ? `${Math.max(18, Math.round(((activeQuestionIndex + 1) / questions.length) * 100))}%`
    : '0%'

  return (
    <div style={previewSurfaceStyle}>
      <div style={previewFrameStyle}>
        <div style={previewHeroStyle}>
          <div style={previewTitleStyle}>{resolvedTitle}</div>
          <div style={previewDescriptionStyle}>
            Tack för att du var med. Vi vill gärna fånga hur dagen landade för dig innan du går vidare.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <PreviewPill>{resolvedCustomer}</PreviewPill>
          </div>
        </div>

        <div style={previewBodyStyle}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 10 }}>
              <div />
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.2, paddingBottom: 2 }}>
                Fråga {questions.length > 0 ? `${activeQuestionIndex + 1}` : '0'} av {questions.length || 0}
              </div>
            </div>

            <div style={{ height: 6, borderRadius: 999, background: 'rgba(14,14,12,0.08)', overflow: 'hidden' }}>
              <div style={{ width: progressWidth, height: '100%', background: 'var(--accent)' }} />
            </div>
          </div>

          {questions.length > 0 ? (
            <>
              {questions.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {questions.map((question, index) => (
                  <button
                    key={`${index}-${question.text}`}
                    type="button"
                    onClick={() => onSelectQuestion(index)}
                    style={{
                      ...previewStepButtonStyle,
                      background: index === activeQuestionIndex ? 'rgba(198,35,104,0.08)' : 'rgba(250,248,246,0.82)',
                      borderColor: index === activeQuestionIndex ? 'rgba(198,35,104,0.22)' : 'rgba(14,14,12,0.08)',
                      color: index === activeQuestionIndex ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    Fråga {index + 1}
                  </button>
                ))}
                </div>
              )}

              <div style={previewQuestionCardStyle}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={previewQuestionBadgeStyle}>Fråga {questions.length > 0 ? activeQuestionIndex + 1 : 1}</div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(14,14,12,0.05)',
                      color: 'var(--text-3)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {activeQuestion?.type === 'scale_1_5' ? 'Skala 1–5' : 'Fritext'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text)', lineHeight: 1.18, letterSpacing: '-0.02em' }}>
                    {activeQuestion?.text}
                  </div>
                </div>

                {activeQuestion?.type === 'scale_1_5' ? (
                  <div style={previewScaleAreaStyle}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
                    {[1, 2, 3, 4, 5].map(value => (
                      <div key={value} style={previewScaleOptionStyle}>
                        {value}
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div style={previewTextAreaStyle}>
                    Här skriver deltagaren sin reflektion med egna ord.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={previewPrimaryButtonStyle}>
                    {questions.length > 1 ? 'Nästa fråga' : 'Börja svara'}
                  </button>
                  <button type="button" style={previewSecondaryButtonStyle}>
                    Tillbaka
                  </button>
                </div>
              </div>

              <div style={previewMiniReviewStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Känslan i slutet
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                  {collectEmail
                    ? 'Efter sista frågan lämnar deltagaren sin e-post i ett separat steg innan svaren skickas in. Det ska kännas tydligt varför uppgiften efterfrågas.'
                    : 'Efter sista frågan skickas svaren in direkt utan identifiering. Avslutet ska kännas kort, lugnt och respektfullt mot deltagarens tid.'}
                </div>
              </div>
            </>
          ) : (
            <div style={previewEmptyStyle}>
              Lägg till minst en fråga i vänsterpanelen för att se hur utvärderingen kommer att se ut.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EvaluationPublishCard({
  created,
  qrUrl,
  onDownloadQr,
}: {
  created: CreatedPayload
  qrUrl: string
  onDownloadQr: () => void
}) {
  function openQrDisplay() {
    window.open(`/dashboard/utvardering/${created.evaluation.id}/qr`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={publishCardStyle}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.02em' }}>
        {created.evaluation.label}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16 }}>
        {created.evaluation.customer} · {created.evaluation.questionSetName || 'Utvärderingsfrågor'}
        <span style={{ marginLeft: 6 }}>
          · {created.evaluation.collectEmail ? 'E-post samlas in' : 'Helt anonym'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={publishLinkCardStyle}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
            Länk till deltagarna
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text)', wordBreak: 'break-all' }}>{created.publicUrl}</div>
        </div>
        <button
          type="button"
          onClick={openQrDisplay}
          style={{ ...publishQrCardStyle, cursor: 'pointer' }}
          title="Öppna QR-koden ensam i ny flik"
        >
          <img src={qrUrl} alt="QR-kod för utvärdering" style={{ width: 220, height: 220, objectFit: 'contain' }} />
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigator.clipboard.writeText(created.publicUrl)} style={ghostButtonStyle}>
            Kopiera länk
          </button>
          <a
            href={created.publicUrl}
            target="_blank"
            rel="noreferrer"
            style={secondaryLinkStyle}
          >
            Öppna deltagarvy
          </a>
          <button type="button" onClick={onDownloadQr} style={ghostButtonStyle}>
            Ladda ner QR som PNG
          </button>
          <button type="button" onClick={openQrDisplay} style={ghostButtonStyle}>
            Visa QR ensam
          </button>
          <Link href={`/dashboard/utvardering/${created.evaluation.id}`} style={secondaryLinkStyle}>
            Öppna översikt
          </Link>
        </div>
      </div>
    </div>
  )
}

function EvaluationFollowupPreviewCard({
  customer,
  training,
  step,
  template,
}: {
  customer: string
  training: string
  step: FollowupStepDraft
  template: FollowupTemplateOption | null
}) {
  return (
    <div style={previewSurfaceStyle}>
      <div style={{
        ...previewFrameStyle,
        minHeight: 820,
        background: 'linear-gradient(180deg, #131111 0%, #131111 230px, rgba(247,244,241,0.9) 230px, rgba(247,244,241,0.96) 100%)',
      }}>
        <div style={previewHeroStyle}>
          <div style={previewEyebrowStyle}>Doings</div>
          <div style={previewTitleStyle}>{training}</div>
          <div style={previewDescriptionStyle}>
            Uppföljning till deltagare från {customer || 'vald kund'}
          </div>
        </div>

        <div style={previewBodyStyle}>
          {template ? (
            <div style={previewQuestionCardStyle}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{
                  display: 'grid',
                  gap: 8,
                  paddingBottom: 14,
                  borderBottom: '1px solid rgba(14,14,12,0.08)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Ämnesrad
                  </div>
                  <div style={{ fontSize: 18, color: 'var(--text)', lineHeight: 1.35, fontWeight: 600 }}>
                    {template.subject}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Från Doings till deltagare från {customer || 'vald kund'}
                  </div>
                </div>

                <div>
                  <div style={previewQuestionBadgeStyle}>{template.eyebrow}</div>
                </div>

                <div style={previewTextAreaStyle}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>
                    Hej,
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 14 }}>
                    {template.headline}
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
                    {template.body}
                  </div>
                  {step.stepType === 'message_link' && (
                    <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginTop: 14 }}>
                      I det här steget leder knappen vidare till nästa resurs eller nästa handling.
                    </div>
                  )}
                  {step.stepType === 'message_questions' && (
                    <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginTop: 14 }}>
                      I det här steget leder knappen vidare till en kort uppföljning. Själva frågeflödet behöver senare definieras och byggas som riktig funktion, inte bara som copy.
                    </div>
                  )}
                  <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginTop: 14 }}>
                    Hälsningar,<br />
                    Doings
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" style={previewPrimaryButtonStyle}>{template.cta}</button>
              </div>
            </div>
          ) : (
            <div style={previewEmptyStyle}>
              Välj en mall i vänsterpanelen för att se hur uppföljningen ser ut för deltagaren.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid rgba(14,14,12,0.08)',
      background: 'rgba(255,255,255,0.88)',
      padding: '12px 14px',
    }}>
      <div style={tinyLabelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
        {value}
      </div>
    </div>
  )
}

function PreviewPill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.14)',
      color: 'rgba(255,255,255,0.84)',
      fontSize: 12.5,
      fontWeight: 600,
      backdropFilter: 'blur(10px)',
    }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'utvardering'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
}

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 0',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: disabled ? 'rgba(14,14,12,0.08)' : 'var(--text)',
    color: disabled ? 'var(--text-3)' : '#fff',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'border-color 0.18s, background 0.18s',
}

const smallDeleteStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid transparent',
  background: 'none',
  color: 'var(--text-3)',
  fontSize: 12,
  cursor: 'pointer',
}

const secondaryLinkStyle: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 12.5,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'border-color 0.18s, background 0.18s',
}

const pageShellStyle: React.CSSProperties = {
  padding: '40px 44px',
  maxWidth: 1360,
  animation: 'fadeUp 0.35s ease both',
}

const evaluationStatsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const workspaceStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 0.92fr) minmax(440px, 1.28fr)',
  gap: 18,
  alignItems: 'start',
}

const editorPanelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  padding: '22px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  minWidth: 0,
}

const previewRailStyle: React.CSSProperties = {
  minWidth: 0,
}

const previewRailInnerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 22,
  display: 'grid',
  gap: 18,
}

const workspaceTabButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.18s, border-color 0.18s, color 0.18s',
}

const followupLaunchButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.92)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.18s, border-color 0.18s, color 0.18s',
  boxShadow: '0 10px 24px rgba(14,14,12,0.05)',
}

const followupPrimaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'var(--text)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const deliveryModeButtonStyle: React.CSSProperties = {
  display: 'block',
  flex: '1 1 220px',
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.9)',
  cursor: 'pointer',
}

const automaticModeNoticeStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid #fdba74',
  background: '#fff7ed',
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const subtlePanelStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.9)',
}

const followupStepCardStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.86)',
  padding: '16px 16px 14px',
  cursor: 'pointer',
}

const followupStatusPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const compactInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '11px 12px',
  borderRadius: 10,
  fontSize: 12.5,
}

const tinyLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--text-3)',
  marginBottom: 8,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-display)',
}

const eyebrowLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const previewSurfaceStyle: React.CSSProperties = {
  ...panelStyle,
  padding: 0,
  overflow: 'hidden',
}

const previewFrameStyle: React.CSSProperties = {
  display: 'grid',
  minHeight: 820,
  background: 'linear-gradient(180deg, #131111 0%, #131111 260px, rgba(247,244,241,0.88) 260px, rgba(247,244,241,0.94) 100%)',
}

const previewHeroStyle: React.CSSProperties = {
  padding: '38px 38px 34px',
}

const previewEyebrowStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 18,
}

const previewTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 36,
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1.02,
  letterSpacing: '-0.03em',
}

const previewDescriptionStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.78)',
  marginTop: 10,
  lineHeight: 1.65,
}

const previewBodyStyle: React.CSSProperties = {
  padding: '0 32px 32px',
  display: 'grid',
  gap: 18,
}

const previewMetaRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const previewMetaCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.74)',
  padding: '16px 18px',
}

const previewMetaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const previewMetaValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 17,
  color: 'var(--text)',
  lineHeight: 1.2,
}

const previewQuestionCardStyle: React.CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 22px 54px rgba(14,14,12,0.08), 0 4px 14px rgba(14,14,12,0.04)',
  padding: 24,
  display: 'grid',
  gap: 16,
}

const previewQuestionBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(198,35,104,0.08)',
  color: 'var(--accent)',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  width: 'fit-content',
}

const previewStepButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.82)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const previewScaleOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 54,
  borderRadius: 16,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.82)',
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  color: 'var(--text)',
}

const previewScaleAreaStyle: React.CSSProperties = {
  minHeight: 120,
  display: 'flex',
  alignItems: 'center',
}

const previewTextAreaStyle: React.CSSProperties = {
  minHeight: 120,
  borderRadius: 16,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.82)',
  padding: '16px 18px',
  color: 'var(--text-3)',
  fontSize: 14,
  lineHeight: 1.7,
}

const previewPrimaryButtonStyle: React.CSSProperties = {
  padding: '13px 20px',
  background: 'var(--text)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const previewSecondaryButtonStyle: React.CSSProperties = {
  ...previewPrimaryButtonStyle,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}


const previewMiniReviewStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.74)',
  padding: '16px 18px',
}

const previewEmptyStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px dashed rgba(14,14,12,0.12)',
  background: 'rgba(255,255,255,0.74)',
  padding: '24px 20px',
  color: 'var(--text-3)',
  fontSize: 13.5,
  lineHeight: 1.7,
}

const publishCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: '22px 24px',
}

const publishLinkCardStyle: React.CSSProperties = {
  background: 'rgba(14,14,12,0.03)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '14px 14px 12px',
}

const publishQrCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: 12,
  background: 'rgba(14,14,12,0.03)',
  border: '1px solid var(--border)',
  borderRadius: 14,
}

const publishHintStyle: React.CSSProperties = {
  ...subtlePanelStyle,
  padding: '20px 22px',
}
