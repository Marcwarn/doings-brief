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
  enabled?: boolean
}

type AudienceMode = 'shared' | 'leaders' | 'mixed'

type DiscoveryTemplateSummary = {
  id: string
  name: string
  audienceMode: AudienceMode
  status: 'draft' | 'active'
  updatedAt: string
  latestOrganisation: string | null
  sessionCount: number
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
    audienceMode: AudienceMode
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

const sharedCategories: DiscoveryCategory[] = [
  { id: 'team', label: 'Teamutveckling', desc: 'Utforska hur samarbetet fungerar i teamet och vad som skulle hjälpa er framåt.', questions: [
    { type: 'open', text: 'Vad fungerar riktigt bra i teamet idag, och var märks det att ni fortfarande har något att lösa?' },
    { type: 'scale', text: 'Hur väl fungerar samarbetet och kommunikationen i teamet i vardagen?' },
    { type: 'choice', text: 'Vilka områden vore mest värdefulla att utveckla just nu? (välj max 2)', max: 2, options: ['Tillit och psykologisk trygghet', 'Kommunikation och dialog', 'Roller och ansvar', 'Konflikthantering', 'Prestation och leverans', 'Energi och motivation'] },
    { type: 'scale', text: 'Hur väl hanterar teamet motgångar, förändringar och pressade lägen?' },
    { type: 'open', text: 'Om teamet tog ett tydligt steg framåt, vad skulle ni märka annorlunda i praktiken?' },
  ] },
  { id: 'ledar', label: 'Ledarskap', desc: 'Förstå vilka ledarbeteenden som behövs nu och vad som behöver stärkas framåt.', questions: [
    { type: 'open', text: 'Vilken ledarskapsutmaning upplever ni som mest angelägen just nu?' },
    { type: 'scale', text: 'Hur väl speglar ledarskapet idag det ni vill stå för som organisation eller grupp?' },
    { type: 'choice', text: 'Vilka ledarnivåer eller roller är viktigast att få med? (välj alla som stämmer)', max: 5, options: ['Förstalinjens chefer', 'Mellanchefer', 'VP/Direktörer', 'Ledningsgrupp', 'Blivande ledare'] },
    { type: 'open', text: 'Om ni har arbetat med ledarutveckling tidigare, vad gav effekt och vad blev mindre träffsäkert?' },
    { type: 'scale', text: 'Hur tydligt följer ni upp om ledarskapet faktiskt utvecklas i önskad riktning?' },
    { type: 'open', text: 'Vad kommer ni att behöva mer av från era ledare det närmaste året?' },
  ] },
  { id: 'change', label: 'Change management', desc: 'Få syn på vad som krävs för att förändringen ska bli begriplig, förankrad och genomförbar.', questions: [
    { type: 'open', text: 'Vad är kärnan i den förändring ni står i eller vill genomföra?' },
    { type: 'scale', text: 'Hur tydligt upplever ni att mandat, riktning och engagemang finns från ledningen?' },
    { type: 'choice', text: 'Var ligger den största utmaningen just nu? (välj max 2)', max: 2, options: ['Motstånd i organisationen', 'Otydlig kommunikation', 'Brist på tid och resurser', 'Ledare som inte är med', 'Gamla strukturer och vanor', 'Osäkerhet om riktningen'] },
    { type: 'scale', text: 'Hur tydligt vet människor vad förändringen innebär för dem i praktiken?' },
    { type: 'open', text: 'Vad riskerar att hända om förändringen inte får fäste på riktigt?' },
  ] },
  { id: 'ai', label: 'AI readiness', desc: 'Skapa en tydligare bild av nuläge, förmåga och nästa relevanta steg inom AI.', questions: [
    { type: 'scale', text: 'Hur integrerat är AI i era arbetssätt och processer idag?' },
    { type: 'scale', text: 'Hur trygga upplever ni att chefer och medarbetare är i att använda AI på ett bra sätt?' },
    { type: 'choice', text: 'Vilket läge beskriver er bäst just nu? (välj en)', max: 1, options: ['Vi utforskar – ingen tydlig riktning', 'Vi testar – några pilotprojekt', 'Vi skalar – AI används brett', 'Vi leder – AI är inbyggt i verksamheten'] },
    { type: 'open', text: 'Vilka roller, processer eller delar av verksamheten påverkas mest av AI just nu?' },
    { type: 'open', text: 'Vad hoppas ni mest på med AI, och vad vill ni undvika att det leder till?' },
  ] },
  { id: 'framat', label: 'Grupp som vill framåt', desc: 'För grupper som har vilja och ambition, men behöver hjälp att samla riktning och rörelse.', questions: [
    { type: 'open', text: 'Varför känns det viktigt att ta tag i det här just nu?' },
    { type: 'scale', text: 'Hur samspelta är ni kring riktning, prioriteringar och nästa steg?' },
    { type: 'open', text: 'Vad skulle behöva bli tydligare eller fungera bättre för att ni ska komma vidare?' },
    { type: 'scale', text: 'Hur väl fungerar beslutsfattande och samarbete i gruppen idag?' },
    { type: 'open', text: 'Vad har ni redan försökt själva, och vad gör att ni ändå vill ha stöd nu?' },
  ] },
  { id: 'komm', label: 'Kommunikation', desc: 'Utforska hur ni kommunicerar idag och vad som behöver bli tydligare, modigare eller mer träffsäkert.', questions: [
    { type: 'open', text: 'Vilken kommunikativ utmaning vill ni få bättre grepp om just nu?' },
    { type: 'choice', text: 'Vilka sammanhang handlar det främst om? (välj alla som stämmer)', max: 6, options: ['Intern kommunikation', 'Chefskommunikation', 'Kundkommunikation', 'Presentationsteknik', 'Digital kommunikation', 'Svåra samtal'] },
    { type: 'scale', text: 'Hur tydligt och konsekvent upplever ni att riktning och beslut kommuniceras idag?' },
    { type: 'open', text: 'Vad tror ni ligger bakom att kommunikationen inte fullt ut fungerar som ni vill?' },
    { type: 'scale', text: 'Hur trygga är människor hos er i att kommunicera uppåt, tvärs och i svåra lägen?' },
  ] },
  { id: 'eb', label: 'Employer branding', desc: 'Förstå hur bilden av er som arbetsgivare hänger ihop med människors faktiska upplevelse.', questions: [
    { type: 'scale', text: 'Hur väl stämmer bilden ni visar utåt med hur det faktiskt upplevs att arbeta hos er?' },
    { type: 'open', text: 'Vilka människor vill ni helst attrahera och behålla, och vad tror ni är viktigt för dem?' },
    { type: 'choice', text: 'Var upplever ni störst glapp idag? (välj max 2)', max: 2, options: ['Rekrytering av rätt profiler', 'Retention av befintliga talanger', 'Intern stolthet och ambassadörskap', 'Tydlighet i EVP', 'Digital närvaro och berättande', 'Ledarnas roll i employer branding'] },
    { type: 'scale', text: 'Hur väl bidrar chefer och medarbetare till att stärka bilden av er som arbetsgivare?' },
    { type: 'open', text: 'Vad är genuint starkt med er som arbetsgivare, och hur tydligt lyckas ni få fram det idag?' },
  ] },
  { id: 'kultur', label: 'Kultur', desc: 'Utforska vilken kultur ni har idag, vad den möjliggör och vad som behöver förflyttas.', questions: [
    { type: 'open', text: 'Om ni beskriver kulturen som den faktiskt känns idag, vad är ni stolta över och vad skaver?' },
    { type: 'scale', text: 'Hur väl märks era värderingar i vardagliga beteenden och beslut?' },
    { type: 'choice', text: 'Vad vill ni framför allt att kulturen ska stödja framåt? (välj max 2)', max: 2, options: ['Högre prestation', 'Mer innovation och mod', 'Bättre samarbete och tillit', 'Stärkt välmående', 'Tydligare ansvar', 'Mer inkludering och mångfald'] },
    { type: 'scale', text: 'Hur tydligt tar chefer och nyckelpersoner ansvar för kulturen i praktiken?' },
    { type: 'open', text: 'Vad skulle vara ett tydligt bevis på att kulturförflyttningen har lyckats?' },
  ] },
  { id: 'trygg', label: 'Psykologisk trygghet', desc: 'Få syn på om människor vågar bidra, säga emot, be om hjälp och lära av misstag.', questions: [
    { type: 'scale', text: 'I vilken grad upplever ni att människor kan lyfta problem, idéer och tveksamheter utan rädsla?' },
    { type: 'scale', text: 'Hur väl uppmuntras olika perspektiv, frågor och konstruktiv oenighet hos er?' },
    { type: 'choice', text: 'Vad verkar främst stå i vägen för större psykologisk trygghet? (välj max 2)', max: 2, options: ['Hierarkier gör det svårt att tala upp', 'Rädsla för att verka inkompetent', 'Negativ historia – kritik har straffats', 'Otydlig kultur kring misstag', 'Enskilda ledarbeteenden', 'Vi vet inte – det är vad vi vill förstå'] },
    { type: 'open', text: 'Beskriv gärna en situation där tryggheten antingen stärktes eller bröts ned.' },
    { type: 'scale', text: 'Hur upplever ni att misstag bemöts hos er idag?' },
  ] },
  { id: 'salj', label: 'Försäljning', desc: 'Utforska vad som behöver stärkas för att skapa bättre kunddialoger, tryggare säljare och fler affärer.', questions: [
    { type: 'scale', text: 'Hur väl fungerar era kunddialoger och affärsmöjligheter idag?' },
    { type: 'choice', text: 'Vilka delar av säljresan är viktigast att utveckla nu? (välj max 2)', max: 2, options: ['Prospektering och nya affärer', 'Behovsanalys och kundförståelse', 'Värdeargumentation och differentiering', 'Stänga affärer och hantera invändningar', 'Merförsäljning och relationsdjup', 'Säljledarskap och coachning'] },
    { type: 'scale', text: 'Hur väl får säljarna stöd, coachning och uppföljning i vardagen?' },
    { type: 'open', text: 'Vad tycker ni skiljer de som lyckas bäst från resten i er säljorganisation?' },
    { type: 'open', text: 'Om en insats gav riktigt bra effekt, vad skulle säljarna kunna göra annorlunda om sex månader?' },
  ] },
  { id: 'vision', label: 'Vision & mål', desc: 'Få syn på hur tydlig riktningen är och hur väl människor känner ansvar för att bidra till den.', questions: [
    { type: 'scale', text: 'Hur tydlig och meningsfull upplevs er övergripande riktning för dem som berörs?' },
    { type: 'scale', text: 'Hur väl förstår människor hur deras arbete hänger ihop med mål och prioriteringar?' },
    { type: 'choice', text: 'Var ligger den största utmaningen kring vision och mål? (välj max 2)', max: 2, options: ['Visionen känns otydlig eller abstrakt', 'Mål och OKR:er är inte förankrade', 'Saknas koppling mellan strategi och vardag', 'Cheferna driver inte frågan', 'Medarbetarna saknar ägarskap', 'Målen förändras för ofta'] },
    { type: 'open', text: 'Hur landar er nuvarande vision eller riktning i organisationen idag?' },
    { type: 'scale', text: 'Hur starkt upplever ni att människor arbetar mot målen, snarare än bara rapporterar på dem?' },
    { type: 'open', text: 'Vad skulle ni vilja att människor förstår, känner eller gör annorlunda efter en insats här?' },
  ] },
]

const defaultIntroTitle = 'Perspektiv'
const defaultIntroText = 'Tack för dialogen hittills. Här vill vi samla in några fördjupande perspektiv från er för att förstå nuläge, behov och riktning bättre. Era svar hjälper oss att skapa en första utgångspunkt tillsammans.'
const defaultAudienceMode: AudienceMode = 'shared'

const audienceCategoryOverrides: Partial<Record<AudienceMode, Partial<Record<string, Partial<DiscoveryCategory>>>>> = {
  leaders: {
    ledar: {
      desc: 'För ledargrupper och chefer som vill förstå vilka ledarbeteenden, förmågor och prioriteringar som behöver stärkas framåt.',
      questions: [
        { type: 'open', text: 'Vilken ledarskapsutmaning är mest avgörande att få grepp om just nu?' },
        { type: 'scale', text: 'Hur väl tycker ni att ledarskapet idag stödjer den riktning ni vill ta som organisation?' },
        { type: 'choice', text: 'Vilka ledarnivåer behöver framför allt utvecklas eller samspela bättre? (välj alla som stämmer)', max: 5, options: ['Förstalinjens chefer', 'Mellanchefer', 'VP/Direktörer', 'Ledningsgrupp', 'Blivande ledare'] },
        { type: 'open', text: 'Var ser ni störst glapp mellan vad som förväntas av ledare och vad som faktiskt händer i vardagen?' },
        { type: 'scale', text: 'Hur tydligt följer ni idag upp ledarbeteenden och faktisk ledareffekt?' },
        { type: 'open', text: 'Vad behöver era ledare i högre grad kunna, bära eller driva det närmaste året?' },
      ],
    },
    change: {
      desc: 'För ledare som behöver skapa mandat, förankring och uthållighet i en förändring.',
      questions: [
        { type: 'open', text: 'Vilken förändring behöver ni få att hända, och varför är den viktig nu?' },
        { type: 'scale', text: 'Hur starkt upplever ni att mandat, ägarskap och uthållighet finns i ledningen?' },
        { type: 'choice', text: 'Var ligger den största ledningsutmaningen i förändringen? (välj max 2)', max: 2, options: ['Motstånd i organisationen', 'Otydlig kommunikation', 'Brist på tid och resurser', 'Ledare som inte är med', 'Gamla strukturer och vanor', 'Osäkerhet om riktningen'] },
        { type: 'scale', text: 'Hur tydlig är er plan för hur förändringen ska översättas till vardagligt beteende?' },
        { type: 'open', text: 'Vad blir konsekvensen om förändringen inte får fäste på lednings- eller chefsnivå?' },
      ],
    },
    ai: {
      desc: 'För ledare som behöver förstå nuläge, förmåga och prioriteringar i AI-arbetet.',
      questions: [
        { type: 'scale', text: 'Hur integrerat är AI i era prioriterade processer och affärskritiska arbetssätt idag?' },
        { type: 'scale', text: 'Hur trygga är ni i ledningen med riktning, prioriteringar och ansvar kring AI?' },
        { type: 'choice', text: 'Vilket läge beskriver er organisation bäst just nu? (välj en)', max: 1, options: ['Vi utforskar – ingen tydlig riktning', 'Vi testar – några pilotprojekt', 'Vi skalar – AI används brett', 'Vi leder – AI är inbyggt i verksamheten'] },
        { type: 'open', text: 'Vilka delar av verksamheten ser ni som mest strategiskt påverkade av AI de närmaste 12–24 månaderna?' },
        { type: 'open', text: 'Vad behöver ni förstå eller få på plats för att kunna ta nästa steg med större trygghet?' },
      ],
    },
    vision: {
      desc: 'För ledare som vill stärka samsyn, riktning och faktisk förflyttning kring mål och prioriteringar.',
      questions: [
        { type: 'scale', text: 'Hur tydlig och handlingsbar upplever ni att er riktning är för chefer och nyckelpersoner?' },
        { type: 'scale', text: 'Hur väl hänger mål, prioriteringar och uppföljning ihop genom organisationen?' },
        { type: 'choice', text: 'Var ligger den största ledningsutmaningen kring vision och mål? (välj max 2)', max: 2, options: ['Visionen känns otydlig eller abstrakt', 'Mål och OKR:er är inte förankrade', 'Saknas koppling mellan strategi och vardag', 'Cheferna driver inte frågan', 'Medarbetarna saknar ägarskap', 'Målen förändras för ofta'] },
        { type: 'open', text: 'Var upplever ni att riktningen tappar kraft eller blir för abstrakt i organisationen?' },
        { type: 'scale', text: 'Hur starkt driver chefer och ledare målen som verkliga prioriteringar i vardagen?' },
        { type: 'open', text: 'Vad behöver bli tydligare för att fler ska kunna omsätta vision och mål i handling?' },
      ],
    },
  },
  mixed: {
    ledar: {
      desc: 'För blandade grupper där ledarskap både ska förstås som ansvar och som något människor upplever i vardagen.',
      questions: [
        { type: 'open', text: 'När ledarskapet fungerar som bäst hos er, vad märks då i vardagen?' },
        { type: 'scale', text: 'Hur väl upplever ni att ledarskapet skapar tydlighet, trygghet och riktning?' },
        { type: 'choice', text: 'Var märks behovet av utveckling tydligast? (välj alla som stämmer)', max: 5, options: ['Förstalinjens chefer', 'Mellanchefer', 'VP/Direktörer', 'Ledningsgrupp', 'Blivande ledare'] },
        { type: 'open', text: 'Vad i ledarskapet skapar idag mest energi eller frustration för gruppen?' },
        { type: 'scale', text: 'Hur tydligt upplever ni att ledarskapet utvecklas utifrån det som faktiskt behövs?' },
        { type: 'open', text: 'Vad skulle ni vilja se mer av från ledare framåt?' },
      ],
    },
    change: {
      desc: 'För blandade grupper där både ledningens intention och människors vardagliga upplevelse av förändring spelar roll.',
      questions: [
        { type: 'open', text: 'Vilken förändring står ni i, och vad upplever ni är viktigast att få rätt?' },
        { type: 'scale', text: 'Hur tydlig känns riktningen i förändringen för dem som berörs?' },
        { type: 'choice', text: 'Var uppstår den största friktionen i förändringen? (välj max 2)', max: 2, options: ['Motstånd i organisationen', 'Otydlig kommunikation', 'Brist på tid och resurser', 'Ledare som inte är med', 'Gamla strukturer och vanor', 'Osäkerhet om riktningen'] },
        { type: 'scale', text: 'Hur väl förstår människor vad förändringen betyder för deras arbete i praktiken?' },
        { type: 'open', text: 'Vad skulle behöva hända för att förändringen ska kännas mer begriplig, möjlig och relevant?' },
      ],
    },
    ai: {
      desc: 'För blandade grupper som behöver en gemensam bild av hur AI påverkar arbetssätt, kompetens och riktning.',
      questions: [
        { type: 'scale', text: 'Hur integrerat är AI i era arbetssätt och processer idag, ur både ledar- och medarbetarperspektiv?' },
        { type: 'scale', text: 'Hur trygga upplever ni att människor är i att använda AI på ett klokt och relevant sätt?' },
        { type: 'choice', text: 'Vilket läge beskriver er bäst just nu? (välj en)', max: 1, options: ['Vi utforskar – ingen tydlig riktning', 'Vi testar – några pilotprojekt', 'Vi skalar – AI används brett', 'Vi leder – AI är inbyggt i verksamheten'] },
        { type: 'open', text: 'Var märker ni att AI redan påverkar roller, arbetssätt eller förväntningar?' },
        { type: 'open', text: 'Vad väcker mest nyfikenhet respektive mest osäkerhet hos er just nu?' },
      ],
    },
    vision: {
      desc: 'För blandade grupper som behöver samsyn kring riktning, mening och ansvar i vardagen.',
      questions: [
        { type: 'scale', text: 'Hur tydlig och meningsfull känns riktningen för dem som ska omsätta den i vardagen?' },
        { type: 'scale', text: 'Hur lätt är det att förstå hur den egna rollen hänger ihop med mål och prioriteringar?' },
        { type: 'choice', text: 'Var uppstår störst glapp mellan riktning och vardag? (välj max 2)', max: 2, options: ['Visionen känns otydlig eller abstrakt', 'Mål och OKR:er är inte förankrade', 'Saknas koppling mellan strategi och vardag', 'Cheferna driver inte frågan', 'Medarbetarna saknar ägarskap', 'Målen förändras för ofta'] },
        { type: 'open', text: 'När blir riktningen tydlig för människor hos er, och när blir den svår att omsätta?' },
        { type: 'scale', text: 'Hur starkt upplever ni att människor arbetar mot målen snarare än bara rapporterar på dem?' },
        { type: 'open', text: 'Vad skulle göra störst skillnad för att skapa mer ägarskap och rörelse kring målen?' },
      ],
    },
  },
}

function cloneQuestion(question: DiscoveryQuestion): DiscoveryQuestion {
  if (question.type === 'choice') {
    return { ...question, options: [...question.options] }
  }
  return { ...question }
}

function cloneCategory(category: DiscoveryCategory): DiscoveryCategory {
  return {
    ...category,
    enabled: typeof category.enabled === 'boolean' ? category.enabled : true,
    questions: category.questions.map(cloneQuestion),
  }
}

function buildDefaultCategories(mode: AudienceMode): DiscoveryCategory[] {
  return sharedCategories.map(category => {
    const base = cloneCategory(category)
    const override = audienceCategoryOverrides[mode]?.[category.id]

    if (!override) return base

    return {
      ...base,
      ...override,
      questions: override.questions ? override.questions.map(cloneQuestion) : base.questions,
    }
  })
}

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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('Perspektiv')
  const [introTitle, setIntroTitle] = useState(defaultIntroTitle)
  const [introText, setIntroText] = useState(defaultIntroText)
  const [audienceMode, setAudienceMode] = useState<'shared' | 'leaders' | 'mixed'>(defaultAudienceMode)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [clientOrganisation, setClientOrganisation] = useState('')
  const [recipientsInput, setRecipientsInput] = useState('')
  const [sendResults, setSendResults] = useState<DiscoverySendResult[] | null>(null)
  const [builderCategories, setBuilderCategories] = useState(() => buildDefaultCategories(defaultAudienceMode))
  const [activeId, setActiveId] = useState(() => buildDefaultCategories(defaultAudienceMode)[0].id)
  const [answers, setAnswers] = useState<Record<string, CategoryState>>(() =>
    Object.fromEntries(buildDefaultCategories(defaultAudienceMode).map(category => [category.id, {}]))
  )
  const [successId, setSuccessId] = useState<string | null>(null)

  const enabledCategories = builderCategories.filter(category => category.enabled)
  const activeCategory = enabledCategories.find(category => category.id === activeId) || enabledCategories[0] || builderCategories[0]

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
        throw new Error(payload?.error || 'Kunde inte hämta uppläggen.')
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
      setError(err instanceof Error ? err.message : 'Kunde inte hämta uppläggen.')
      setLoading(false)
    }
  }

  function resetBuilder() {
    setCurrentTemplateId(null)
    setTemplateName('Perspektiv')
    setIntroTitle(defaultIntroTitle)
    setIntroText(defaultIntroText)
    setAudienceMode(defaultAudienceMode)
    const nextCategories = buildDefaultCategories(defaultAudienceMode)
    setBuilderCategories(nextCategories)
    setActiveId(nextCategories[0].id)
    setAnswers(Object.fromEntries(nextCategories.map(category => [category.id, {}])))
    setSuccessId(null)
    setSaveState('idle')
    setShowTemplatePicker(false)
    setTemplateQuery('')
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
        enabled: true,
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
        throw new Error(payload?.error || 'Kunde inte läsa upplägget.')
      }

      const template = (payload as DiscoveryTemplateDetail).template
      const nextCategories = mapTemplateToCategories(template)

      setCurrentTemplateId(template.id)
      setTemplateName(template.name)
      setIntroTitle(template.introTitle)
      setIntroText(template.introText)
      setAudienceMode(template.audienceMode || defaultAudienceMode)
      const fallbackCategories = buildDefaultCategories(template.audienceMode || defaultAudienceMode)
      const loadedCategories = nextCategories.length > 0 ? nextCategories : fallbackCategories
      setBuilderCategories(loadedCategories)
      setActiveId(loadedCategories[0]?.id || fallbackCategories[0].id)
      setAnswers(Object.fromEntries(loadedCategories.map(category => [category.id, {}])))
      setSuccessId(null)
      setSaveState('idle')
      setShowTemplatePicker(false)
      setTemplateQuery('')

      if (knownTemplates) {
        setTemplates(knownTemplates)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte läsa upplägget.')
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
          audienceMode,
          status,
          sections: builderCategories.filter(category => category.enabled).map((category, categoryIndex) => ({
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
        throw new Error(payload?.error || 'Kunde inte spara upplägget.')
      }

      const savedTemplateId = typeof payload?.templateId === 'string' ? payload.templateId : currentTemplateId
      setCurrentTemplateId(savedTemplateId || null)
      setSaveState('saved')
      await loadTemplateList(savedTemplateId || undefined)

      window.setTimeout(() => {
        setSaveState(current => current === 'saved' ? 'idle' : current)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara upplägget.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTemplate() {
    setSendError(null)
    setSendResults(null)

    if (!currentTemplateId) {
      setSendError('Spara upplägget innan du skickar det.')
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
        throw new Error(payload?.error || 'Kunde inte skicka utskicket.')
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
      setSendError(err instanceof Error ? err.message : 'Kunde inte skicka utskicket.')
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

  function applyAudienceDefaults(nextMode: AudienceMode) {
    const nextCategories = buildDefaultCategories(nextMode)
    setBuilderCategories(nextCategories)
    setActiveId(currentActiveId => nextCategories.some(category => category.id === currentActiveId) ? currentActiveId : nextCategories[0].id)
    setAnswers(Object.fromEntries(nextCategories.map(category => [category.id, {}])))
    setSuccessId(null)
    setSaveState('idle')
  }

  function updateCategoryField(categoryId: string, field: 'label' | 'desc', value: string) {
    setBuilderCategories(prev => prev.map(category => (
      category.id === categoryId ? { ...category, [field]: value } : category
    )))
  }

  function toggleCategoryEnabled(categoryId: string) {
    const enabledCount = builderCategories.filter(category => category.enabled).length

    setBuilderCategories(prev => {
      const target = prev.find(category => category.id === categoryId)
      if (!target) return prev
      if (target.enabled && enabledCount <= 1) return prev

      const next = prev.map(category => (
        category.id === categoryId ? { ...category, enabled: !category.enabled } : category
      ))

      const nextEnabled = next.filter(category => category.enabled)
      if (!nextEnabled.some(category => category.id === activeId)) {
        setActiveId(nextEnabled[0]?.id || next[0].id)
      }

      return next
    })

    setSuccessId(null)
    setSaveState('idle')
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

  const filteredTemplates = templates.filter(template => {
    if (!templateQuery.trim()) return true
    const query = templateQuery.trim().toLowerCase()
    return [template.name, template.latestOrganisation || '', audienceLabel(template.audienceMode)]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
  const enabledCount = enabledCategories.length
  const sendSuccessCount = sendResults?.filter(result => result.ok).length || 0
  const sendFailureCount = sendResults?.filter(result => !result.ok).length || 0

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 72px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <aside style={{ position: 'sticky', top: 22 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 18px 20px' }}>
              {(error || sendError) && <div style={{ marginBottom: 14 }}><InlineError text={error || sendError || ''} /></div>}

              <div style={{ ...pickerPanelStyle, marginBottom: 16 }}>
                <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Aktiva teman
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {enabledCount} av {builderCategories.length} områden med i discoveryt
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                    Klicka på ett tema för att slå av eller på det. Nedtonade teman följer inte med i previewn eller i utskicket.
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {builderCategories.map(category => {
                    const isActive = category.id === activeId
                    const isEnabled = !!category.enabled

                    return (
                      <button
                        key={`${category.id}-chip`}
                        type="button"
                        onClick={() => {
                          if (!isEnabled && enabledCount <= 1) return
                          toggleCategoryEnabled(category.id)
                          if (isEnabled && activeId === category.id) return
                          if (category.enabled) setActiveId(category.id)
                        }}
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${isEnabled ? (isActive ? 'var(--accent)' : 'rgba(198,35,104,0.22)') : 'rgba(14,14,12,0.08)'}`,
                          background: isEnabled ? (isActive ? 'rgba(198,35,104,0.12)' : 'rgba(198,35,104,0.06)') : 'rgba(14,14,12,0.04)',
                          color: isEnabled ? (isActive ? 'var(--accent)' : 'var(--text)') : 'var(--text-3)',
                          padding: '9px 13px',
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 600,
                          cursor: 'pointer',
                          opacity: isEnabled ? 1 : 0.55,
                          transition: 'opacity 0.18s, border-color 0.18s, background 0.18s',
                        }}
                      >
                        {category.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Upplägget
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                    Här styr du vilket discovery du arbetar i, namnet på upplägget och den övergripande introduktionen.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => resetBuilder()} style={secondaryButtonStyle}>
                      Skapa nytt
                    </button>
                    <button type="button" onClick={() => setShowTemplatePicker(current => !current)} style={secondaryButtonStyle}>
                      {showTemplatePicker ? 'Stäng tidigare' : 'Öppna tidigare'}
                    </button>
                    <button type="button" onClick={() => void saveTemplate('draft')} disabled={saving || Boolean(loadingTemplateId)} style={primaryButtonStyle(saving || Boolean(loadingTemplateId))}>
                      {saving ? 'Sparar…' : saveState === 'saved' ? 'Sparat' : 'Spara upplägg'}
                    </button>
                  </div>

                  {currentTemplateId && !showTemplatePicker && (
                    <div style={pickerPanelStyle}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                        Öppet nu
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {templates.find(template => template.id === currentTemplateId)?.name || templateName}
                      </div>
                    </div>
                  )}

                  {showTemplatePicker && (
                    <div style={pickerPanelStyle}>
                      <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Tidigare discovery</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                          Fortsätt i ett upplägg du redan har börjat arbeta med. Kund, målgrupp och senaste aktivitet hjälper dig hitta rätt.
                        </div>
                      </div>

                      <input
                        value={templateQuery}
                        onChange={event => setTemplateQuery(event.target.value)}
                        placeholder="Sök på namn, kund eller målgrupp"
                        style={editorInputStyle}
                      />

                      <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
                        {filteredTemplates.map(template => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => void loadTemplate(template.id)}
                            style={{
                              ...templateRowStyle,
                              borderColor: template.id === currentTemplateId ? 'rgba(198,35,104,0.35)' : 'rgba(14,14,12,0.08)',
                              background: template.id === currentTemplateId ? 'rgba(198,35,104,0.06)' : 'rgba(255,255,255,0.88)',
                            }}
                          >
                            <div style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                                {(template.latestOrganisation?.trim() || 'Utan kund kopplad') + ' · ' + template.name}
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
                                {formatRelativeDate(template.updatedAt)} · {audienceLabel(template.audienceMode)} · {template.sessionCount === 0 ? 'Inte skickat ännu' : `${template.sessionCount} utskick`}
                              </div>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
                              {loadingTemplateId === template.id ? 'Öppnar…' : 'Öppna'}
                            </div>
                          </button>
                        ))}
                        {filteredTemplates.length === 0 && (
                          <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '10px 2px' }}>
                            Inga tidigare discovery matchar din sökning.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Field label="Namn internt">
                  <input
                    value={templateName}
                    onChange={event => setTemplateName(event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Rubrik i introduktionen">
                  <input
                    value={introTitle}
                    onChange={event => setIntroTitle(event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Inledning">
                  <textarea
                    value={introText}
                    onChange={event => setIntroText(event.target.value)}
                    rows={3}
                    style={{ ...editorInputStyle, minHeight: 88, resize: 'vertical' }}
                  />
                </Field>

                <Field label="Målgrupp">
                  <select
                    value={audienceMode}
                    onChange={event => setAudienceMode(event.target.value as AudienceMode)}
                    style={editorInputStyle}
                  >
                    <option value="shared">Blandad eller oklar målgrupp</option>
                    <option value="leaders">Främst ledare</option>
                    <option value="mixed">Blandad grupp med ledare och medarbetare</option>
                  </select>
                </Field>

                <div style={{ marginTop: -6, marginBottom: 4 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                    Målgruppen sparas på upplägget. Du kan också ladda rekommenderade standardfrågor för den valda målgruppen utan att bygga om allt för hand.
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => applyAudienceDefaults(audienceMode)}
                      style={secondaryButtonStyle}
                    >
                      Ladda rekommenderade frågor
                    </button>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>
                      Påverkar främst Ledarskap, Change management, AI readiness och Vision & mål.
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Skicka underlag
                  </div>

                  <Field label="Organisation eller kund">
                    <input
                      value={clientOrganisation}
                      onChange={event => setClientOrganisation(event.target.value)}
                      placeholder="Till exempel Acme AB"
                      style={editorInputStyle}
                    />
                  </Field>

                  <Field label="Mottagare och kontaktpersoner">
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
                    {sending ? 'Skickar…' : 'Skicka underlag'}
                  </button>

                  {sendResults && sendResults.length > 0 && sendSuccessCount > 0 && (
                    <div style={{
                      background: sendFailureCount > 0 ? '#fff7ed' : '#f4fbf6',
                      border: `1px solid ${sendFailureCount > 0 ? '#fed7aa' : '#ccefd5'}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'grid',
                      gap: 4,
                    }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: sendFailureCount > 0 ? '#9a3412' : '#166534' }}>
                        {sendFailureCount > 0
                          ? `${sendSuccessCount} skickades, ${sendFailureCount} gick inte fram`
                          : `${sendSuccessCount} mottagare fick utskicket`}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: sendFailureCount > 0 ? '#9a3412' : '#166534' }}>
                        {sendFailureCount > 0
                          ? 'Se status per mottagare nedan och försök igen för dem som inte fick mejlet.'
                          : 'Discovery-länkarna är nu utskickade och du kan följa svaren under inkomna svar.'}
                      </div>
                    </div>
                  )}

                  {sendResults && sendResults.length > 0 && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Status per mottagare
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

                <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                        Aktivt tema
                      </div>
                      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                        {activeCategory.label}
                      </h2>
                    </div>
                    <Link href="/dashboard/discovery/responses" style={responsesLinkStyle}>
                      Inkomna svar
                    </Link>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                    Förhandsvisningen till höger uppdateras direkt när du ändrar namn, intro eller frågor i det här temat.
                  </div>

                <Field label="Temats namn">
                  <input
                    value={activeCategory.label}
                    onChange={event => updateCategoryField(activeCategory.id, 'label', event.target.value)}
                    style={editorInputStyle}
                  />
                </Field>

                <Field label="Temats inledning">
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
                          <Field label="Svarsalternativ, ett per rad">
                            <textarea
                              value={question.options.join('\n')}
                              onChange={event => updateChoiceOptions(activeCategory.id, questionIndex, event.target.value)}
                              rows={Math.max(4, question.options.length)}
                              style={{ ...editorInputStyle, minHeight: 120, resize: 'vertical' }}
                            />
                          </Field>
                          <Field label="Högsta antal val">
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
            </div>
          </aside>

          <section style={{ minWidth: 0 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 18px 48px rgba(16,24,40,0.06)' }}>
              <header style={{ background: 'var(--text)', color: '#fff' }}>
                <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 28, height: 28 }} />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>Discovery</div>
                  </div>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
                    Behovsanalys
                  </div>
                </div>

                <div style={{ padding: '42px 28px 76px', position: 'relative', overflow: 'hidden' }}>
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
              </header>

              <div style={{ padding: '30px 28px 0', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', paddingBottom: 2 }}>
                  {enabledCategories.map(category => {
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

              <div style={{ padding: '22px 28px 32px' }}>
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
                    Skicka in svar →
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
                Tack. Vi har tagit emot era svar och återkommer med nästa steg.
              </div>
            )}
              </div>
            </div>
          </section>
        </div>
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

function audienceLabel(mode: AudienceMode) {
  switch (mode) {
    case 'leaders':
      return 'Främst ledare'
    case 'mixed':
      return 'Blandad grupp'
    default:
      return 'Bred målgrupp'
  }
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Uppdaterad nyligen'

  const now = new Date()
  const sameDay = now.toDateString() === date.toDateString()
  if (sameDay) return 'Uppdaterad idag'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (yesterday.toDateString() === date.toDateString()) return 'Uppdaterad igår'

  return `Uppdaterad ${date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
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

const pickerPanelStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  background: 'var(--bg)',
  padding: '14px',
}

const templateRowStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 12,
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  cursor: 'pointer',
}

const themeToggleStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  cursor: 'pointer',
}
