'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'

type DiscoveryQuestion =
  | { type: 'open'; text: string }
  | { type: 'scale'; text: string }
  | { type: 'choice'; text: string; max: number; options: string[] }

type DiscoveryCategory = {
  id: string
  label: string
  desc: string
  questions: DiscoveryQuestion[]
}

type DiscoveryTemplateSummary = {
  id: string
  name: string
  status: 'draft' | 'active'
  updatedAt: string
}

type DiscoverySendResult = {
  sessionId: string
  email: string
  ok: boolean
  token?: string
  url?: string
  reason?: string
}

type DiscoveryTemplateDetail = {
  template: {
    id: string
    name: string
    introTitle: string
    introText: string
    status: 'draft' | 'active'
    createdAt: string
    updatedAt: string
    sections: Array<{
      id: string
      label: string
      description: string
      orderIndex: number
      questions: Array<{
        id: string
        type: 'open' | 'choice' | 'scale'
        text: string
        orderIndex: number
        maxChoices: number | null
        scaleMin: number | null
        scaleMax: number | null
        scaleMinLabel: string | null
        scaleMaxLabel: string | null
        options: Array<{
          id: string
          label: string
          orderIndex: number
        }>
      }>
    }>
  }
}

const categories: DiscoveryCategory[] = [
  { id: 'team', label: 'Teamutveckling', desc: 'Stark samarbete, tillit och prestation i teamet.', questions: [
    { type: 'open', text: 'Vad fungerar bra i teamet idag – och vad är den största utmaningen?' },
    { type: 'scale', text: 'Hur väl fungerar samarbetet och kommunikationen inom teamet?' },
    { type: 'choice', text: 'Vad är den viktigaste utvecklingsfrågan? (välj max 2)', max: 2, options: ['Tillit och psykologisk trygghet', 'Kommunikation och dialog', 'Roller och ansvar', 'Konflikthantering', 'Prestation och leverans', 'Energi och motivation'] },
    { type: 'scale', text: 'Hur hanterar teamet motgångar och förändringar?' },
    { type: 'open', text: 'Vad skulle ett högpresterande team innebära för er verksamhet?' },
  ] },
  { id: 'ledar', label: 'Ledarskap', desc: 'Utveckla chefer och ledare att göra verklig skillnad.', questions: [
    { type: 'open', text: 'Vad är den viktigaste ledarskapsutmaningen i er organisation just nu?' },
    { type: 'scale', text: 'Hur väl reflekterar ert ledarskap det ni säger er stå för som organisation?' },
    { type: 'choice', text: 'Vilka ledarnivåer berörs? (välj alla som stämmer)', max: 5, options: ['Förstalinjens chefer', 'Mellanchefer', 'VP/Direktörer', 'Ledningsgrupp', 'Blivande ledare'] },
    { type: 'open', text: 'Har ni gjort ledarutveckling tidigare – vad fungerade, vad fungerade inte?' },
    { type: 'scale', text: 'Hur mäter ni ledarskapseffekt idag?' },
    { type: 'open', text: 'Vad förväntas av era ledare om 1–3 år?' },
  ] },
  { id: 'change', label: 'Change management', desc: 'Leda och landa förändring på ett hållbart sätt.', questions: [
    { type: 'open', text: 'Vad är kärnan i den förändring ni ska genomföra?' },
    { type: 'scale', text: 'Hur starkt är mandatet och engagemanget från toppen?' },
    { type: 'choice', text: 'Vad är den största utmaningen i förändringen? (välj max 2)', max: 2, options: ['Motstånd i organisationen', 'Otydlig kommunikation', 'Brist på tid och resurser', 'Ledare som inte är med', 'Gamla strukturer och vanor', 'Osäkerhet om riktningen'] },
    { type: 'scale', text: 'Hur tydlig är kommunikationsplanen för förändringen?' },
    { type: 'open', text: 'Vad är det värsta som händer om förändringen inte landar?' },
  ] },
  { id: 'ai', label: 'AI readiness', desc: 'Förstå var ni är och vart ni behöver komma med AI.', questions: [
    { type: 'scale', text: 'Hur väl använder ni AI i era processer och arbetssätt idag?' },
    { type: 'scale', text: 'Hur ser kompetensen och tryggheten kring AI ut bland medarbetare och chefer?' },
    { type: 'choice', text: 'Var befinner ni er i AI-resan? (välj en)', max: 1, options: ['Vi utforskar – ingen tydlig riktning', 'Vi testar – några pilotprojekt', 'Vi skalar – AI används brett', 'Vi leder – AI är inbyggt i verksamheten'] },
    { type: 'open', text: 'Vilka processer eller roller upplever ni som mest exponerade för AI-förändring?' },
    { type: 'open', text: 'Vad är er största oro – och er största förhoppning – kring AI?' },
  ] },
  { id: 'framat', label: 'Grupp som vill framåt', desc: 'För team eller ledningsgrupper som vill ta nästa steg.', questions: [
    { type: 'open', text: 'Vad är anledningen till att ni söker stöd just nu?' },
    { type: 'scale', text: 'Är gruppen överens om riktningen – eller är det en del av utmaningen?' },
    { type: 'open', text: 'Vad behöver hända för att ni ska säga att insatsen var lyckad?' },
    { type: 'scale', text: 'Hur ser beslutsfattandet och samarbetet i gruppen ut idag?' },
    { type: 'open', text: 'Vad hindrar er från att röra er i den riktningen på egen hand?' },
  ] },
  { id: 'komm', label: 'Kommunikation', desc: 'Förbättra hur ni kommunicerar – internt och externt.', questions: [
    { type: 'open', text: 'Vad är den kommunikativa utmaningen ni vill lösa?' },
    { type: 'choice', text: 'Vad gäller det? (välj alla som stämmer)', max: 6, options: ['Intern kommunikation', 'Chefskommunikation', 'Kundkommunikation', 'Presentationsteknik', 'Digital kommunikation', 'Svåra samtal'] },
    { type: 'scale', text: 'Hur tydligt och konsekvent kommuniceras riktning och beslut i organisationen?' },
    { type: 'open', text: 'Vad tror ni skapar de kommunikativa bristerna – kompetens, kultur eller struktur?' },
    { type: 'scale', text: 'Hur trygga är medarbetarna att kommunicera uppåt och tvärs i organisationen?' },
  ] },
  { id: 'eb', label: 'Employer branding', desc: 'Attrahera, engagera och behåll rätt talanger.', questions: [
    { type: 'scale', text: 'Hur väl reflekterar er externa bild verkligheten som medarbetare upplever den?' },
    { type: 'open', text: 'Vilka målgrupper vill ni attrahera och behålla – och vad värderar de?' },
    { type: 'choice', text: 'Var upplever ni störst gap? (välj max 2)', max: 2, options: ['Rekrytering av rätt profiler', 'Retention av befintliga talanger', 'Intern stolthet och ambassadörskap', 'Tydlighet i EVP', 'Digital närvaro och berättande', 'Ledarnas roll i employer branding'] },
    { type: 'scale', text: 'Hur väl agerar chefer och medarbetare som ambassadörer för organisationen?' },
    { type: 'open', text: 'Vad gör er unika som arbetsgivare – och kommunicerar ni det tillräckligt tydligt?' },
  ] },
  { id: 'kultur', label: 'Kultur', desc: 'Forma, förstärka eller förändra kulturen som driver resultat.', questions: [
    { type: 'open', text: 'Beskriv er kultur som den är idag – vad är ni stolta över och vad vill ni förändra?' },
    { type: 'scale', text: 'I vilken grad lever organisationen upp till sina uttalade värderingar i vardagen?' },
    { type: 'choice', text: 'Vad ska kulturen möjliggöra? (välj max 2)', max: 2, options: ['Högre prestation', 'Mer innovation och mod', 'Bättre samarbete och tillit', 'Stärkt välmående', 'Tydligare ansvar', 'Mer inkludering och mångfald'] },
    { type: 'scale', text: 'Hur väl förstår chefer sin roll som kulturbärare?' },
    { type: 'open', text: 'Vad skulle vara det tydligaste tecknet på att er kulturresa har lyckats?' },
  ] },
  { id: 'trygg', label: 'Psykologisk trygghet', desc: 'Skapa miljöer där folk vågar tala upp och lära av misstag.', questions: [
    { type: 'scale', text: 'I vilken grad kan medarbetare ta upp problem och idéer utan rädsla för konsekvenser?' },
    { type: 'scale', text: 'Hur väl uppmuntrar chefer olikheter i perspektiv och konstruktiv oenighet?' },
    { type: 'choice', text: 'Vad verkar hindra psykologisk trygghet hos er? (välj max 2)', max: 2, options: ['Hierarkier gör det svårt att tala upp', 'Rädsla för att verka inkompetent', 'Negativ historia – kritik har straffats', 'Otydlig kultur kring misstag', 'Enskilda ledarbeteenden', 'Vi vet inte – det är vad vi vill förstå'] },
    { type: 'open', text: 'Ge ett konkret exempel på en situation där psykologisk trygghet bröts ned – eller byggdes upp.' },
    { type: 'scale', text: 'Hur ser organisationen på misstag – som lärotillfällen eller misslyckanden?' },
  ] },
  { id: 'salj', label: 'Försäljning', desc: 'Kompetens och kultur för att driva affärer med självförtroende.', questions: [
    { type: 'scale', text: 'Hur effektivt driver säljarna kunddialoger och affärsmöjligheter idag?' },
    { type: 'choice', text: 'Vad är den viktigaste utvecklingsfrågan i sälj? (välj max 2)', max: 2, options: ['Prospektering och nya affärer', 'Behovsanalys och kundförståelse', 'Värdeargumentatio och differentiering', 'Stänga affärer och hantera invändningar', 'Merförsäljning och relationsdjup', 'Säljledarskap och coachning'] },
    { type: 'scale', text: 'Hur väl coachas och följs säljarna upp av sina chefer i vardagen?' },
    { type: 'open', text: 'Vad skiljer era bästa säljare från resten – och hur sprider ni de beteendena?' },
    { type: 'open', text: 'Vad ska en säljare hos er kunna göra 6 månader efter en insats – som de inte kan idag?' },
  ] },
  { id: 'vision', label: 'Vision & mål', desc: 'Samsyn, riktning och ägarskap kring vart ni är på väg.', questions: [
    { type: 'scale', text: 'Hur tydlig och inspirerande är er vision och strategi för medarbetarna?' },
    { type: 'scale', text: 'I vilken grad vet medarbetarna hur deras arbete bidrar till organisationens mål?' },
    { type: 'choice', text: 'Vad är den viktigaste utmaningen kring vision och mål? (välj max 2)', max: 2, options: ['Visionen känns otydlig eller abstrakt', 'Mål och OKR:er är inte förankrade', 'Saknas koppling mellan strategi och vardag', 'Cheferna driver inte frågan', 'Medarbetarna saknar ägarskap', 'Målen förändras för ofta'] },
    { type: 'open', text: 'Hur formulerades er nuvarande vision – och hur väl landar den i organisationen?' },
    { type: 'scale', text: 'Hur starkt är engagemanget kring era mål – strävar man mot dem, eller rapporterar man om dem?' },
    { type: 'open', text: 'Vad vill ni att folk ska känna och göra annorlunda kring vision och mål efter er insats?' },
  ] },
]

const defaultIntroTitle = 'Berätta vad ni behöver'
const defaultIntroText = 'Välj det område som känns mest relevant och svara på frågorna. Vi återkommer med ett skräddarsytt förslag.'

type CategoryState = Record<number, string | string[]>

function answeredCount(category: DiscoveryCategory, answers: CategoryState) {
  return category.questions.reduce((count, question, index) => {
    const value = answers[index]
    if (question.type === 'scale' && typeof value === 'string' && value) return count + 1
    if (question.type === 'open' && typeof value === 'string' && value.trim().length > 2) return count + 1
    if (question.type === 'choice' && Array.isArray(value) && value.length > 0) return count + 1
    return count
  }, 0)
}

export default function DiscoveryPage() {
  const [loading, setLoading] = useState(true)
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<DiscoveryTemplateSummary[]>([])
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('Discovery-upplägg')
  const [introTitle, setIntroTitle] = useState(defaultIntroTitle)
  const [introText, setIntroText] = useState(defaultIntroText)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [clientOrganisation, setClientOrganisation] = useState('')
  const [recipientsInput, setRecipientsInput] = useState('')
  const [sendResults, setSendResults] = useState<DiscoverySendResult[] | null>(null)
  const [builderCategories, setBuilderCategories] = useState(categories)
  const [activeId, setActiveId] = useState(categories[0].id)
  const [answers, setAnswers] = useState<Record<string, CategoryState>>(() =>
    Object.fromEntries(categories.map(category => [category.id, {}]))
  )
  const [successId, setSuccessId] = useState<string | null>(null)

  const activeCategory = builderCategories.find(category => category.id === activeId) || builderCategories[0]

  const activeProgress = useMemo(() => {
    const count = answeredCount(activeCategory, answers[activeCategory.id] || {})
    return {
      count,
      percent: Math.round((count / activeCategory.questions.length) * 100),
    }
  }, [activeCategory, answers])

  useEffect(() => {
    void loadTemplateList()
  }, [])

  async function loadTemplateList(preferredTemplateId?: string) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/discovery/templates', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte hämta discovery-uppläggen.')
      }

      const nextTemplates = Array.isArray(payload?.templates) ? payload.templates as DiscoveryTemplateSummary[] : []
      setTemplates(nextTemplates)

      const templateIdToLoad = preferredTemplateId
        || currentTemplateId
        || nextTemplates[0]?.id

      if (templateIdToLoad) {
        await loadTemplate(templateIdToLoad, nextTemplates)
      } else {
        resetBuilder()
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta discovery-uppläggen.')
      setLoading(false)
    }
  }

  function resetBuilder() {
    setCurrentTemplateId(null)
    setTemplateName('Discovery-upplägg')
    setIntroTitle(defaultIntroTitle)
    setIntroText(defaultIntroText)
    setBuilderCategories(categories)
    setActiveId(categories[0].id)
    setAnswers(Object.fromEntries(categories.map(category => [category.id, {}])))
    setSuccessId(null)
    setSaveState('idle')
  }

  function parseRecipients(input: string) {
    const lines = input
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: 'Lägg till minst en mottagare.' }
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
    const seen = new Set<string>()
    const recipients: Array<{ name: string; email: string; role: string | null }> = []

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      let name = ''
      let email = ''
      let role = ''

      const angleMatch = line.match(/^(.*?)<([^>]+)>(?:\s*[,|-]\s*(.+))?$/)
      if (angleMatch) {
        name = angleMatch[1].trim().replace(/,$/, '')
        email = angleMatch[2].trim()
        role = angleMatch[3]?.trim() || ''
      } else if (line.includes(',')) {
        const parts = line.split(',').map(part => part.trim()).filter(Boolean)
        if (parts.length >= 3 && emailPattern.test(parts[1])) {
          name = parts[0]
          email = parts[1]
          role = parts.slice(2).join(', ')
        } else if (parts.length === 2 && emailPattern.test(parts[1])) {
          name = parts[0]
          email = parts[1]
        } else if (parts.length === 2 && emailPattern.test(parts[0])) {
          email = parts[0]
          role = parts[1]
        }
      } else if (emailPattern.test(line)) {
        email = line
      }

      if (!emailPattern.test(email)) {
        return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: `Rad ${index + 1} har fel format. Använd "Namn, e-post" eller "Namn <e-post>".` }
      }

      const normalizedEmail = email.toLowerCase()
      if (seen.has(normalizedEmail)) {
        return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: `E-postadressen ${normalizedEmail} finns flera gånger i listan.` }
      }

      seen.add(normalizedEmail)
      recipients.push({
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        role: role || null,
      })
    }

    return { recipients, error: null }
  }

  function mapTemplateToCategories(payload: DiscoveryTemplateDetail['template']): DiscoveryCategory[] {
    return payload.sections
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((section, sectionIndex) => ({
        id: section.id || `section-${sectionIndex + 1}`,
        label: section.label,
        desc: section.description,
        questions: [...section.questions]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(question => {
            if (question.type === 'choice') {
              return {
                type: 'choice' as const,
                text: question.text,
                max: question.maxChoices || 1,
                options: [...question.options]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map(option => option.label),
              }
            }

            if (question.type === 'scale') {
              return { type: 'scale' as const, text: question.text }
            }

            return { type: 'open' as const, text: question.text }
          }),
      }))
  }

  async function loadTemplate(templateId: string, knownTemplates?: DiscoveryTemplateSummary[]) {
    setLoadingTemplateId(templateId)
    setError(null)

    try {
      const response = await fetch(`/api/discovery/templates/${templateId}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte läsa discovery-upplägget.')
      }

      const template = (payload as DiscoveryTemplateDetail).template
      const nextCategories = mapTemplateToCategories(template)

      setCurrentTemplateId(template.id)
      setTemplateName(template.name)
      setIntroTitle(template.introTitle)
      setIntroText(template.introText)
      setBuilderCategories(nextCategories.length > 0 ? nextCategories : categories)
      setActiveId(nextCategories[0]?.id || categories[0].id)
      setAnswers(Object.fromEntries((nextCategories.length > 0 ? nextCategories : categories).map(category => [category.id, {}])))
      setSuccessId(null)
      setSaveState('idle')

      if (knownTemplates) {
        setTemplates(knownTemplates)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte läsa discovery-upplägget.')
    } finally {
      setLoadingTemplateId(null)
      setLoading(false)
    }
  }

  async function saveTemplate(status: 'draft' | 'active' = 'draft') {
    setSaving(true)
    setSaveState('idle')
    setError(null)

    try {
      const response = await fetch('/api/discovery/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentTemplateId,
          name: templateName,
          introTitle,
          introText,
          status,
          sections: builderCategories.map((category, categoryIndex) => ({
            label: category.label,
            description: category.desc,
            orderIndex: categoryIndex,
            questions: category.questions.map((question, questionIndex) => ({
              type: question.type,
              text: question.text,
              orderIndex: questionIndex,
              maxChoices: question.type === 'choice' ? question.max : null,
              scaleMin: question.type === 'scale' ? 1 : null,
              scaleMax: question.type === 'scale' ? 5 : null,
              scaleMinLabel: question.type === 'scale' ? 'Håller inte alls' : null,
              scaleMaxLabel: question.type === 'scale' ? 'Håller helt' : null,
              options: question.type === 'choice'
                ? question.options.map(option => ({ label: option }))
                : [],
            })),
          })),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte spara discovery-upplägget.')
      }

      const savedTemplateId = typeof payload?.templateId === 'string' ? payload.templateId : currentTemplateId
      setCurrentTemplateId(savedTemplateId || null)
      setSaveState('saved')
      await loadTemplateList(savedTemplateId || undefined)

      window.setTimeout(() => {
        setSaveState(current => current === 'saved' ? 'idle' : current)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara discovery-upplägget.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTemplate() {
    setSendError(null)
    setSendResults(null)

    if (!currentTemplateId) {
      setSendError('Spara discovery-upplägget innan du skickar det.')
      return
    }

    const { recipients, error: recipientError } = parseRecipients(recipientsInput)
    if (recipientError) {
      setSendError(recipientError)
      return
    }

    setSending(true)

    try {
      const response = await fetch('/api/discovery/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: currentTemplateId,
          organisation: clientOrganisation,
          recipients,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok && !payload?.results) {
        throw new Error(payload?.error || 'Kunde inte skicka discovery-utskicket.')
      }

      const nextResults = Array.isArray(payload?.results) ? payload.results as DiscoverySendResult[] : []
      setSendResults(nextResults)

      if (!response.ok) {
        setSendError('Inga discovery-mejl kunde skickas. Kontrollera mottagarna och försök igen.')
      } else if (payload?.failed > 0) {
        setSendError(`${payload.failed} mottagare kunde inte få mejlet. Övriga skickades.`)
      } else {
        setRecipientsInput('')
        setClientOrganisation('')
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Kunde inte skicka discovery-utskicket.')
    } finally {
      setSending(false)
    }
  }

  function setScale(categoryId: string, questionIndex: number, value: string) {
    setAnswers(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [questionIndex]: value },
    }))
  }

  function setOpen(categoryId: string, questionIndex: number, value: string) {
    setAnswers(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [questionIndex]: value },
    }))
  }

  function toggleChoice(categoryId: string, questionIndex: number, option: string, max: number) {
    setAnswers(prev => {
      const current = Array.isArray(prev[categoryId]?.[questionIndex]) ? [...(prev[categoryId][questionIndex] as string[])] : []
      const exists = current.includes(option)
      const next = exists
        ? current.filter(item => item !== option)
        : (current.length >= max ? [...current.slice(1), option] : [...current, option])

      return {
        ...prev,
        [categoryId]: { ...prev[categoryId], [questionIndex]: next },
      }
    })
  }

  function clearCategory(categoryId: string) {
    setAnswers(prev => ({ ...prev, [categoryId]: {} }))
    setSuccessId(null)
  }

  function submitCategory(categoryId: string) {
    setSuccessId(categoryId)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    window.setTimeout(() => {
      setSuccessId(current => current === categoryId ? null : current)
    }, 6000)
  }

  function updateCategoryField(categoryId: string, field: 'label' | 'desc', value: string) {
    setBuilderCategories(prev => prev.map(category => (
      category.id === categoryId ? { ...category, [field]: value } : category
    )))
  }

  function updateQuestionText(categoryId: string, questionIndex: number, value: string) {
    setBuilderCategories(prev => prev.map(category => {
      if (category.id !== categoryId) return category
      return {
        ...category,
        questions: category.questions.map((question, index) => (
          index === questionIndex ? { ...question, text: value } : question
        )),
      }
    }))
  }

  function updateChoiceOptions(categoryId: string, questionIndex: number, value: string) {
    setBuilderCategories(prev => prev.map(category => {
      if (category.id !== categoryId) return category
      return {
        ...category,
        questions: category.questions.map((question, index) => {
          if (index !== questionIndex || question.type !== 'choice') return question
          const options = value
            .split('\n')
            .map(option => option.trim())
            .filter(Boolean)
          return {
            ...question,
            options,
          }
        }),
      }
    }))
  }

  function updateChoiceMax(categoryId: string, questionIndex: number, value: number) {
    setBuilderCategories(prev => prev.map(category => {
      if (category.id !== categoryId) return category
      return {
        ...category,
        questions: category.questions.map((question, index) => {
          if (index !== questionIndex || question.type !== 'choice') return question
          return {
            ...question,
            max: Math.max(1, Math.min(value || 1, question.options.length || 1)),
          }
        }),
      }
    }))
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--text)', color: '#fff' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ padding: '24px 34px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 28, height: 28 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>Discovery</div>
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
            Behovsanalys
          </div>
        </div>

        <div style={{ padding: '42px 34px 76px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            inset: 'auto auto -18px 0',
            width: '100%',
            height: 38,
            background: 'var(--bg)',
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }} />
          <h1 style={{
            margin: '0 0 12px',
            maxWidth: 640,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            position: 'relative',
            zIndex: 1,
          }}>
            {introTitle.split('behöver').length > 1
              ? <>{introTitle.replace('behöver', '')}<span style={{ color: 'var(--accent)' }}>behöver</span></>
              : <>{introTitle}</>
            }
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 610,
            fontSize: 15.5,
            lineHeight: 1.75,
            color: 'rgba(255,255,255,0.74)',
            position: 'relative',
            zIndex: 1,
          }}>
            {introText}
          </p>
        </div>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ padding: '30px 34px 0', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', paddingBottom: 2 }}>
          {categories.map(category => {
            const active = category.id === activeId
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveId(category.id)
                  setSuccessId(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-2)',
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 8px 20px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      <main style={{ padding: '22px 34px 72px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.88fr) minmax(0, 1.42fr)', gap: 22, alignItems: 'start' }}>
          <aside style={{ position: 'sticky', top: 22 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 18px 20px' }}>
              {(error || sendError) && <div style={{ marginBottom: 14 }}><InlineError text={error || sendError || ''} /></div>}

              <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Redigering
                </div>
                <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                  {activeCategory.label}
                </h2>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                  Redigera innehållet till vänster. Kundens vy uppdateras direkt till höger.
                </p>
                <div style={{ marginTop: 12 }}>
                  <Link href="/dashboard/discovery/responses" style={responsesLinkStyle}>
                    Öppna discovery-svar
                  </Link>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Field label="Sparat upplägg">
                    <select
                      value={currentTemplateId || ''}
                      onChange={event => {
                        const nextId = event.target.value
                        if (nextId) {
                          void loadTemplate(nextId)
                        } else {
                          resetBuilder()
                        }
                      }}
                      disabled={Boolean(loadingTemplateId) || saving}
                      style={editorInputStyle}
                    >
                      <option value="">Nytt discovery-upplägg</option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => resetBuilder()} style={secondaryButtonStyle}>
                      Nytt
                    </button>
                    <button type="button" onClick={() => void saveTemplate('draft')} disabled={saving || Boolean(loadingTemplateId)} style={primaryButtonStyle(saving || Boolean(loadingTemplateId))}>
                      {saving ? 'Sparar…' : saveState === 'saved' ? 'Sparat' : 'Spara upplägg'}
                    </button>
                  </div>
                </div>

                <Field label="Internt namn">
                  <input
                    value={templateName}
                    onChange={event => setTemplateName(event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Rubrik">
                  <input
                    value={introTitle}
                    onChange={event => setIntroTitle(event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Ingress">
                  <textarea
                    value={introText}
                    onChange={event => setIntroText(event.target.value)}
                    rows={3}
                    style={{ ...editorInputStyle, minHeight: 88, resize: 'vertical' }}
                  />
                </Field>

                <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Skicka discovery
                  </div>

                  <Field label="Organisation">
                    <input
                      value={clientOrganisation}
                      onChange={event => setClientOrganisation(event.target.value)}
                      placeholder="Till exempel Acme AB"
                      style={editorInputStyle}
                    />
                  </Field>

                  <Field label="Mottagare">
                    <textarea
                      value={recipientsInput}
                      onChange={event => setRecipientsInput(event.target.value)}
                      rows={6}
                      placeholder={'Anna Andersson, anna@bolag.se\nErik Eriksson <erik@bolag.se>'}
                      style={{ ...editorInputStyle, minHeight: 128, resize: 'vertical' }}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={() => void sendTemplate()}
                    disabled={sending}
                    style={primaryButtonStyle(sending)}
                  >
                    {sending ? 'Skickar…' : 'Skicka discovery'}
                  </button>

                  {sendResults && sendResults.length > 0 && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Skickstatus
                      </div>
                      {sendResults.map(result => (
                        <div key={result.sessionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                          <span style={{ color: 'var(--text)' }}>{result.email}</span>
                          <span style={{ color: result.ok ? '#166534' : '#8e244c' }}>
                            {result.ok ? 'Skickat' : (result.reason || 'Misslyckades')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Field label="Temanamn">
                  <input
                    value={activeCategory.label}
                    onChange={event => updateCategoryField(activeCategory.id, 'label', event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Introduktion">
                  <textarea
                    value={activeCategory.desc}
                    onChange={event => updateCategoryField(activeCategory.id, 'desc', event.target.value)}
                    rows={3}
                    style={{ ...editorInputStyle, minHeight: 88, resize: 'vertical' }}
                  />
                </Field>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeCategory.questions.map((question, questionIndex) => (
                    <div key={`${activeCategory.id}-editor-${questionIndex}`} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Fråga {questionIndex + 1}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          {question.type === 'open' ? 'Öppen' : question.type === 'scale' ? 'Skala' : 'Val'}
                        </div>
                      </div>

                      <textarea
                        value={question.text}
                        onChange={event => updateQuestionText(activeCategory.id, questionIndex, event.target.value)}
                        rows={question.type === 'open' ? 3 : 2}
                        style={{ ...editorInputStyle, minHeight: question.type === 'open' ? 92 : 72, resize: 'vertical' }}
                      />

                      {question.type === 'choice' && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                          <Field label="Alternativ, ett per rad">
                            <textarea
                              value={question.options.join('\n')}
                              onChange={event => updateChoiceOptions(activeCategory.id, questionIndex, event.target.value)}
                              rows={Math.max(4, question.options.length)}
                              style={{ ...editorInputStyle, minHeight: 120, resize: 'vertical' }}
                            />
                          </Field>
                          <Field label="Max antal val">
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, question.options.length)}
                              value={question.max}
                              onChange={event => updateChoiceMax(activeCategory.id, questionIndex, Number(event.target.value))}
                              style={editorInputStyle}
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section>
            <section style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                {activeCategory.label}
              </h2>
              <p style={{ margin: 0, maxWidth: 620, fontSize: 14.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
                {activeCategory.desc}
              </p>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeCategory.questions.map((question, questionIndex) => {
                const value = answers[activeCategory.id]?.[questionIndex]
                return (
                  <article
                    key={`${activeCategory.id}-${questionIndex}`}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      padding: '22px 24px 20px',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Fråga {questionIndex + 1}
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.58, color: 'var(--text)', marginBottom: 18, maxWidth: 720 }}>
                      {question.text}
                    </div>

                    {question.type === 'scale' && (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          {[1, 2, 3, 4, 5].map(option => {
                            const selected = value === `${option}`
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setScale(activeCategory.id, questionIndex, `${option}`)}
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 12,
                                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                  background: selected ? 'var(--accent)' : 'transparent',
                                  color: selected ? '#fff' : 'var(--text-2)',
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {option}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: 'var(--text-3)', maxWidth: 250 }}>
                          <span>Håller inte alls</span>
                          <span>Håller helt</span>
                        </div>
                      </>
                    )}

                    {question.type === 'open' && (
                      <textarea
                        value={typeof value === 'string' ? value : ''}
                        onChange={event => setOpen(activeCategory.id, questionIndex, event.target.value)}
                        placeholder="Skriv ditt svar här…"
                        rows={3}
                        style={{
                          width: '100%',
                          minHeight: 104,
                          resize: 'vertical',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          padding: '14px 16px',
                          fontSize: 14,
                          lineHeight: 1.6,
                          fontFamily: 'var(--font-sans)',
                          outline: 'none',
                        }}
                      />
                    )}

                    {question.type === 'choice' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                        {question.options.map(option => {
                          const checked = Array.isArray(value) && value.includes(option)
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => toggleChoice(activeCategory.id, questionIndex, option, question.max)}
                              style={{
                                borderRadius: 999,
                                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                                background: checked ? 'var(--accent-dim)' : 'var(--bg)',
                                color: checked ? 'var(--accent)' : 'var(--text-2)',
                                padding: '9px 15px',
                                fontSize: 13,
                                lineHeight: 1.4,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${activeProgress.percent}%`, height: '100%', borderRadius: 999, background: 'var(--accent)', transition: 'width 0.25s ease' }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
                    {activeProgress.count} av {activeCategory.questions.length} besvarade
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => clearCategory(activeCategory.id)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--text-2)',
                      padding: '11px 18px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                  Rensa
                  </button>
                  <button
                    type="button"
                    onClick={() => submitCategory(activeCategory.id)}
                    style={{
                      border: 'none',
                      borderRadius: 10,
                      background: 'var(--accent)',
                      color: '#fff',
                      padding: '11px 24px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                    }}
                  >
                    Skicka svar till Doings →
                  </button>
                </div>
              </div>
            </div>

            {successId === activeCategory.id && (
              <div style={{
                marginTop: 18,
                background: '#f1f7ea',
                border: '1px solid #d7e7c4',
                borderRadius: 12,
                padding: '16px 18px',
                fontSize: 14,
                lineHeight: 1.6,
                color: '#43611b',
              }}>
                Tack! Vi har tagit emot era svar och återkommer med ett skräddarsytt förslag.
              </div>
            )}
          </section>
        </div>
      </main>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const editorInputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '12px 14px',
  fontSize: 13.5,
  lineHeight: 1.55,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  resize: 'none',
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 10,
    background: disabled ? 'var(--border)' : 'var(--accent)',
    color: '#fff',
    padding: '11px 16px',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--text-2)',
  padding: '11px 16px',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

const responsesLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-2)',
  textDecoration: 'none',
  fontSize: 12.5,
  fontWeight: 600,
}
