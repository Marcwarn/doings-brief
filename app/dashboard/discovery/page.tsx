'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
type DiscoveryResponseMode = 'named' | 'anonymous'

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
  label?: string
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

type DiscoveryDataPayload = {
  template: {
    id: string
    name: string
    introTitle: string
  }
  overview: {
    invitedCount: number
    submittedCount: number
    pendingCount: number
    responseRate: number
    latestSubmittedAt: string | null
  }
  sections: Array<{
    id: string
    label: string
    description: string
    orderIndex: number
    questionCount: number
  }>
  sessions: Array<{
    id: string
    clientName: string
    clientEmail: string
    clientOrganisation: string | null
    responseMode?: DiscoveryResponseMode
    respondentCount?: number
    status: 'pending' | 'submitted'
    createdAt: string
    submittedAt: string | null
    sectionResponses: Array<{
      sectionId: string
      answeredCount: number
      excerpts: string[]
    }>
  }>
}

type DiscoveryAnalysisLens =
  | 'Gemensamma behov'
  | 'Skillnader i perspektiv'
  | 'Beredskap för nästa steg'
  | 'Vad bör utforskas vidare'

type DiscoveryAnalysisPayload = {
  lens: DiscoveryAnalysisLens
  preliminary: boolean
  caution: string | null
  scope: {
    template_id: string
    theme_id: string | null
    respondent_count: number
    audience_mode: AudienceMode
  }
  summary: string
  observations: Array<{
    title: string
    detail: string
    confidence: 'high' | 'medium' | 'low'
    evidence_ids: string[]
  }>
  differences: Array<{
    title: string
    detail: string
    confidence: 'high' | 'medium' | 'low'
    evidence_ids: string[]
  }>
  uncertainties: Array<{
    title: string
    detail: string
    evidence_ids: string[]
  }>
  next_questions: string[]
  evidence: Array<{
    id: string
    theme_id: string
    respondent_label: string
    excerpt: string
  }>
}

type DiscoveryAiStatus = {
  configured: {
    berget: boolean
    openai: boolean
    anthropic: boolean
  }
  currentProvider: 'berget' | 'anthropic' | null
  preferredProvider: 'berget' | 'openai' | 'anthropic' | null
  ready: boolean
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
const discoveryAnalysisLenses: DiscoveryAnalysisLens[] = [
  'Gemensamma behov',
  'Skillnader i perspektiv',
  'Beredskap för nästa steg',
  'Vad bör utforskas vidare',
]

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

function customerKeyForSession(session: {
  clientName: string
  clientOrganisation: string | null
}) {
  return (session.clientOrganisation?.trim() || session.clientName.trim() || 'okand-kund').toLowerCase()
}

function customerLabelForSession(session: {
  clientName: string
  clientOrganisation: string | null
}) {
  return session.clientOrganisation?.trim() || session.clientName.trim() || 'Okänd kund'
}

function buildTemplateDraftSnapshot(input: {
  templateName: string
  introTitle: string
  introText: string
  audienceMode: AudienceMode
  builderCategories: DiscoveryCategory[]
}) {
  return JSON.stringify({
    templateName: input.templateName.trim(),
    introTitle: input.introTitle.trim(),
    introText: input.introText.trim(),
    audienceMode: input.audienceMode,
    builderCategories: input.builderCategories.map(category => ({
      id: category.id,
      label: category.label.trim(),
      desc: category.desc.trim(),
      enabled: typeof category.enabled === 'boolean' ? category.enabled : true,
      questions: category.questions.map(question => (
        question.type === 'choice'
          ? {
              type: question.type,
              text: question.text.trim(),
              max: question.max,
              options: question.options.map(option => option.trim()),
            }
          : {
              type: question.type,
              text: question.text.trim(),
            }
      )),
    })),
  })
}

function isAutosaveReady(input: {
  templateName: string
  introTitle: string
  introText: string
  builderCategories: DiscoveryCategory[]
}) {
  if (!input.templateName.trim() || !input.introTitle.trim() || !input.introText.trim()) {
    return false
  }

  const enabledCategories = input.builderCategories.filter(category => category.enabled)
  if (enabledCategories.length === 0) return false

  return enabledCategories.every(category => {
    if (!category.label.trim() || !category.desc.trim() || category.questions.length === 0) {
      return false
    }

    return category.questions.every(question => {
      if (!question.text.trim()) return false

      if (question.type !== 'choice') return true

      const options = question.options.map(option => option.trim()).filter(Boolean)
      return options.length > 0 && question.max >= 1 && question.max <= options.length
    })
  })
}

export default function DiscoveryPage() {
  const [loading, setLoading] = useState(true)
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<DiscoveryTemplateSummary[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [editorTab, setEditorTab] = useState<'questions' | 'setup' | 'send' | 'data'>('questions')
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('Perspektiv')
  const [introTitle, setIntroTitle] = useState(defaultIntroTitle)
  const [introText, setIntroText] = useState(defaultIntroText)
  const [audienceMode, setAudienceMode] = useState<'shared' | 'leaders' | 'mixed'>(defaultAudienceMode)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [clientOrganisation, setClientOrganisation] = useState('')
  const [recipientsInput, setRecipientsInput] = useState('')
  const [responseMode, setResponseMode] = useState<DiscoveryResponseMode>('named')
  const [sendResults, setSendResults] = useState<DiscoverySendResult[] | null>(null)
  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null)
  const [builderCategories, setBuilderCategories] = useState(() => buildDefaultCategories(defaultAudienceMode))
  const [activeId, setActiveId] = useState(() => buildDefaultCategories(defaultAudienceMode)[0].id)
  const [answers, setAnswers] = useState<Record<string, CategoryState>>(() =>
    Object.fromEntries(buildDefaultCategories(defaultAudienceMode).map(category => [category.id, {}]))
  )
  const [successId, setSuccessId] = useState<string | null>(null)
  const [dataPayload, setDataPayload] = useState<DiscoveryDataPayload | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dataStatusFilter, setDataStatusFilter] = useState<'all' | 'submitted' | 'pending'>('all')
  const [dataQuery, setDataQuery] = useState('')
  const [selectedDataSectionId, setSelectedDataSectionId] = useState<string>('all')
  const [selectedDataSessionId, setSelectedDataSessionId] = useState<string>('none')
  const [selectedAnalysisLens, setSelectedAnalysisLens] = useState<DiscoveryAnalysisLens>('Gemensamma behov')
  const [analysisPayload, setAnalysisPayload] = useState<DiscoveryAnalysisPayload | null>(null)
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisCached, setAnalysisCached] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<DiscoveryAiStatus | null>(null)
  const [lastSavedDraftSnapshot, setLastSavedDraftSnapshot] = useState<string | null>(null)
  const [lastFailedDraftSnapshot, setLastFailedDraftSnapshot] = useState<string | null>(null)
  const currentTemplateIdRef = useRef<string | null>(null)
  const savePromiseRef = useRef<Promise<string | null> | null>(null)

  const enabledCategories = builderCategories.filter(category => category.enabled)
  const activeCategory = enabledCategories.find(category => category.id === activeId) || enabledCategories[0] || builderCategories[0]

  const activeProgress = useMemo(() => {
    const count = answeredCount(activeCategory, answers[activeCategory.id] || {})
    return {
      count,
      percent: Math.round((count / activeCategory.questions.length) * 100),
    }
  }, [activeCategory, answers])

  const filteredDataSessions = useMemo(() => {
    const sessions = dataPayload?.sessions || []
    const query = dataQuery.trim().toLowerCase()

    return sessions.filter(session => {
      if (dataStatusFilter !== 'all' && session.status !== dataStatusFilter) return false
      if (!query) return true
      return [session.clientName, session.clientEmail, session.clientOrganisation || '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [dataPayload, dataQuery, dataStatusFilter])

  const customerGroups = useMemo(() => {
    const submitted = filteredDataSessions.filter(session => session.status === 'submitted')
    const groups = new Map<string, {
      key: string
      label: string
      sessions: typeof submitted
      respondentCount: number
      latestSubmittedAt: string | null
      responseMode: DiscoveryResponseMode | 'mixed'
    }>()

    for (const session of submitted) {
      const key = customerKeyForSession(session)
      const current = groups.get(key) || {
        key,
        label: customerLabelForSession(session),
        sessions: [],
        respondentCount: 0,
        latestSubmittedAt: null,
        responseMode: session.responseMode || 'named',
      }

      current.sessions.push(session)
      current.respondentCount += session.responseMode === 'anonymous'
        ? (session.respondentCount || 0)
        : 1

      if (!current.latestSubmittedAt || (session.submittedAt && session.submittedAt > current.latestSubmittedAt)) {
        current.latestSubmittedAt = session.submittedAt
      }

      if (current.responseMode !== (session.responseMode || 'named')) {
        current.responseMode = 'mixed'
      }

      groups.set(key, current)
    }

    return Array.from(groups.values()).sort((a, b) => (b.latestSubmittedAt || '').localeCompare(a.latestSubmittedAt || ''))
  }, [filteredDataSessions])

  const selectedDataScope = useMemo(() => {
    if (selectedDataSessionId === 'none') return 'none'
    return customerGroups.some(group => `customer:${group.key}` === selectedDataSessionId)
      ? selectedDataSessionId
      : 'none'
  }, [customerGroups, selectedDataSessionId])

  const scopedDataSessions = useMemo(() => {
    if (selectedDataScope === 'none') return []
    const customerKey = selectedDataScope.replace(/^customer:/, '')
    return filteredDataSessions.filter(session => customerKeyForSession(session) === customerKey)
  }, [filteredDataSessions, selectedDataScope])

  const dataThemeCards = useMemo(() => {
    const sections = dataPayload?.sections || []
    const submittedSessions = scopedDataSessions.filter(session => session.status === 'submitted')

    return sections
      .filter(section => enabledCategories.some(category => category.id === section.id))
      .map(section => {
        const sessionEntries = submittedSessions
          .map(session => ({
            session,
            response: session.sectionResponses.find(item => item.sectionId === section.id) || null,
          }))
          .filter(entry => entry.response && entry.response.answeredCount > 0)

        const respondentCount = sessionEntries.length
        const totalAnswered = sessionEntries.reduce((sum, entry) => sum + (entry.response?.answeredCount || 0), 0)
        const possibleAnswers = submittedSessions.length > 0 && section.questionCount > 0
          ? submittedSessions.length * section.questionCount
          : 0
        const coveragePercent = possibleAnswers > 0 ? Math.round((totalAnswered / possibleAnswers) * 100) : 0
        const firstExcerpt = sessionEntries
          .flatMap(entry => entry.response?.excerpts || [])
          .find(Boolean) || ''

        let signalLabel = 'Inga svar ännu'
        if (respondentCount > 0 && coveragePercent >= 70) signalLabel = 'Tydlig signal'
        else if (respondentCount > 0 && coveragePercent >= 35) signalLabel = 'Viss signal'
        else if (respondentCount > 0) signalLabel = 'På väg'

        const splitLabel = respondentCount >= 4 && coveragePercent >= 35 && coveragePercent <= 65
          ? 'Olika perspektiv'
          : ''

        return {
          ...section,
          respondentCount,
          coveragePercent,
          signalLabel,
          splitLabel,
          excerpt: firstExcerpt,
        }
      })
  }, [dataPayload, enabledCategories, scopedDataSessions])

  const selectedDataSectionIdOrDefault = useMemo(() => {
    if (selectedDataSectionId === 'all') return 'all'
    return dataThemeCards.some(section => section.id === selectedDataSectionId)
      ? selectedDataSectionId
      : 'all'
  }, [dataThemeCards, selectedDataSectionId])

  const dataOverview = useMemo(() => {
    const invitedCount = scopedDataSessions.length
    const submittedCount = scopedDataSessions.reduce((sum, session) => {
      if (session.responseMode === 'anonymous') {
        return sum + (session.respondentCount || 0)
      }
      return sum + (session.status === 'submitted' ? 1 : 0)
    }, 0)
    const pendingCount = scopedDataSessions.filter(session => session.status === 'pending').length
    const latestSubmittedAt = scopedDataSessions
      .map(session => session.submittedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null

    return {
      invitedCount,
      submittedCount,
      pendingCount,
      responseRate: invitedCount > 0 ? Math.min(100, Math.round((submittedCount / invitedCount) * 100)) : 0,
      latestSubmittedAt,
      strongSignalCount: dataThemeCards.filter(card => card.signalLabel === 'Tydlig signal').length,
      splitCount: dataThemeCards.filter(card => card.splitLabel).length,
    }
  }, [dataThemeCards, scopedDataSessions])

  const rawDataSessions = useMemo(() => {
    const baseSessions = selectedDataScope === 'none'
      ? []
      : scopedDataSessions

    return baseSessions.filter(session => {
      if (selectedDataSectionIdOrDefault === 'all') return true
      return session.sectionResponses.some(item => item.sectionId === selectedDataSectionIdOrDefault && item.answeredCount > 0)
    })
  }, [scopedDataSessions, selectedDataScope, selectedDataSectionIdOrDefault])

  const draftSnapshot = useMemo(() => buildTemplateDraftSnapshot({
    templateName,
    introTitle,
    introText,
    audienceMode,
    builderCategories,
  }), [audienceMode, builderCategories, introText, introTitle, templateName])

  const autosaveEnabled = useMemo(() => isAutosaveReady({
    templateName,
    introTitle,
    introText,
    builderCategories,
  }), [builderCategories, introText, introTitle, templateName])
  const hasUnsavedChanges = lastSavedDraftSnapshot !== null && draftSnapshot !== lastSavedDraftSnapshot

  useEffect(() => {
    void loadTemplateList()
  }, [])

  useEffect(() => {
    currentTemplateIdRef.current = currentTemplateId
  }, [currentTemplateId])

  useEffect(() => {
    if (loading) return

    if (lastSavedDraftSnapshot === null) {
      setLastSavedDraftSnapshot(draftSnapshot)
    }
  }, [draftSnapshot, lastSavedDraftSnapshot, loading])

  useEffect(() => {
    if (loading || saving || sending) return
    if (!autosaveEnabled || lastSavedDraftSnapshot === null) return
    if (draftSnapshot === lastSavedDraftSnapshot) return
    if (draftSnapshot === lastFailedDraftSnapshot) return

    const timeoutId = window.setTimeout(() => {
      void saveTemplate('draft', { silent: true })
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [autosaveEnabled, draftSnapshot, lastFailedDraftSnapshot, lastSavedDraftSnapshot, loading, saving, sending])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (editorTab !== 'data' || !currentTemplateId) return
    void loadData(currentTemplateId)
  }, [editorTab, currentTemplateId])

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
    setResponseMode('named')
    const nextCategories = buildDefaultCategories(defaultAudienceMode)
    setBuilderCategories(nextCategories)
    setActiveId(nextCategories[0].id)
    setAnswers(Object.fromEntries(nextCategories.map(category => [category.id, {}])))
    setSuccessId(null)
    setSaveState('idle')
    setLastSavedDraftSnapshot(null)
    setLastFailedDraftSnapshot(null)
    setShowTemplatePicker(false)
    setTemplateQuery('')
    setDataPayload(null)
    setDataError(null)
    setDataStatusFilter('all')
    setDataQuery('')
    setSelectedDataSectionId('all')
    setSelectedDataSessionId('none')
    setSelectedAnalysisLens('Gemensamma behov')
    setAnalysisPayload(null)
    setAnalysisUpdatedAt(null)
    setAnalysisError(null)
    setAnalysisCached(false)
  }

  async function loadData(templateId: string) {
    setDataLoading(true)
    setDataError(null)

    try {
      const response = await fetch(`/api/discovery/data/${templateId}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte läsa datavyn.')
      }

      setDataPayload(payload as DiscoveryDataPayload)
      setSelectedDataSessionId('none')
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Kunde inte läsa datavyn.')
      setDataPayload(null)
    } finally {
      setDataLoading(false)
    }
  }

  async function loadAnalysisStatus() {
    try {
      const response = await fetch('/api/discovery/analyze', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) return
      setAnalysisStatus(payload as DiscoveryAiStatus)
    } catch {
      // Keep this silent; the analysis panel will still work off explicit errors.
    }
  }

  async function runAnalysis(regenerate = false) {
    if (!currentTemplateId) return

    setAnalysisLoading(true)
    setAnalysisError(null)

    try {
      const response = await fetch('/api/discovery/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: currentTemplateId,
          themeId: selectedDataSectionIdOrDefault === 'all' ? null : selectedDataSectionIdOrDefault,
          lens: selectedAnalysisLens,
          query: dataQuery,
          customerKey: selectedDataScope.startsWith('customer:') ? selectedDataScope.replace(/^customer:/, '') : null,
          regenerate,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Kunde inte analysera svaren.')
      }

      setAnalysisPayload(payload.analysis as DiscoveryAnalysisPayload)
      setAnalysisUpdatedAt(typeof payload.updatedAt === 'string' ? payload.updatedAt : null)
      setAnalysisCached(payload.cached === true)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Kunde inte analysera svaren.')
      setAnalysisPayload(null)
      setAnalysisUpdatedAt(null)
      setAnalysisCached(false)
    } finally {
      setAnalysisLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalysisStatus()
  }, [])

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
      setResponseMode('named')
      const fallbackCategories = buildDefaultCategories(template.audienceMode || defaultAudienceMode)
      const loadedCategories = nextCategories.length > 0 ? nextCategories : fallbackCategories
      const loadedAudienceMode = template.audienceMode || defaultAudienceMode
      setBuilderCategories(loadedCategories)
      setActiveId(loadedCategories[0]?.id || fallbackCategories[0].id)
      setAnswers(Object.fromEntries(loadedCategories.map(category => [category.id, {}])))
      setLastSavedDraftSnapshot(buildTemplateDraftSnapshot({
        templateName: template.name,
        introTitle: template.introTitle,
        introText: template.introText,
        audienceMode: loadedAudienceMode,
        builderCategories: loadedCategories,
      }))
      setLastFailedDraftSnapshot(null)
      setSuccessId(null)
      setSaveState('idle')
      setShowTemplatePicker(false)
      setTemplateQuery('')
      setDataPayload(null)
      setDataError(null)
      setDataStatusFilter('all')
      setDataQuery('')
      setSelectedDataSectionId('all')
      setSelectedDataSessionId('none')
      setSelectedAnalysisLens('Gemensamma behov')
      setAnalysisPayload(null)
      setAnalysisUpdatedAt(null)
      setAnalysisError(null)
      setAnalysisCached(false)

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

  async function saveTemplate(status: 'draft' | 'active' = 'draft', options?: { silent?: boolean }) {
    if (savePromiseRef.current) {
      return savePromiseRef.current
    }

    const snapshotAtRequest = draftSnapshot
    const requestTemplateId = currentTemplateIdRef.current
    const request = (async () => {
      setSaving(true)
      setSaveState('saving')
      if (!options?.silent) {
        setError(null)
      }

      try {
        const response = await fetch('/api/discovery/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: requestTemplateId,
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

        const savedTemplateId = typeof payload?.templateId === 'string' ? payload.templateId : requestTemplateId
        setCurrentTemplateId(savedTemplateId || null)
        currentTemplateIdRef.current = savedTemplateId || null
        setLastSavedDraftSnapshot(snapshotAtRequest)
        setLastFailedDraftSnapshot(null)
        setSaveState('saved')
        await loadTemplateList(savedTemplateId || undefined)

        window.setTimeout(() => {
          setSaveState(current => current === 'saved' ? 'idle' : current)
        }, 3000)
        return savedTemplateId || null
      } catch (err) {
        setLastFailedDraftSnapshot(snapshotAtRequest)
        setSaveState('error')
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : 'Kunde inte spara upplägget.')
        }
        return null
      } finally {
        setSaving(false)
        savePromiseRef.current = null
      }
    })()

    savePromiseRef.current = request
    return request
  }

  async function sendTemplate() {
    setSendError(null)
    setSendResults(null)
    setCopiedShareUrl(null)

    const activeSave = savePromiseRef.current
    if (activeSave) {
      await activeSave
    }

    let templateIdForSend = currentTemplateIdRef.current
    if (autosaveEnabled && (hasUnsavedChanges || !templateIdForSend)) {
      templateIdForSend = await saveTemplate('draft')
    }

    if (!templateIdForSend) {
      setSendError('Spara upplägget innan du skickar det.')
      return
    }

    const { recipients, error: recipientError } = responseMode === 'named'
      ? parseRecipients(recipientsInput)
      : { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: null }
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
          templateId: templateIdForSend,
          organisation: clientOrganisation,
          responseMode,
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
        if (responseMode === 'named') {
          setRecipientsInput('')
          setClientOrganisation('')
        }
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

  async function copyShareUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedShareUrl(url)
      window.setTimeout(() => {
        setCopiedShareUrl(current => current === url ? null : current)
      }, 2500)
    } catch {
      setSendError('Kunde inte kopiera länken automatiskt. Markera och kopiera den manuellt.')
    }
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
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 72px', display: 'grid', gap: 18 }}>
        <section style={builderHeroStyle}>
          <div>
            <div style={builderHeroEyebrowStyle}>Discovery</div>
            <h1 style={builderHeroTitleStyle}>Bygg till vänster, se discoveryt till höger.</h1>
          </div>
          <div style={builderHeroAsideStyle}>
            <div style={builderHeroAsideLabelStyle}>Arbetsmodell</div>
            <div style={builderHeroAsideValueStyle}>Editor + preview</div>
            <div style={builderHeroAsideMetaStyle}>Från tema till underlag.</div>
          </div>
        </section>

        <div style={builderSummaryStripStyle}>
          <DataSummaryCard label="Teman" value={`${enabledCount}`} sublabel={`${builderCategories.length} i biblioteket`} />
          <DataSummaryCard label="Målgrupp" value={audienceLabel(audienceMode)} sublabel="vald" />
          <DataSummaryCard label="Svarsläge" value={responseMode === 'anonymous' ? 'Anonym länk' : 'Personliga länkar'} sublabel="för utskick" />
          <DataSummaryCard label="Upplägg" value={templateName.trim() || 'Nytt discovery'} sublabel={currentTemplateId ? 'sparat' : 'inte sparat'} />
        </div>

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
                          if (isEnabled && enabledCount <= 1) return

                          if (isEnabled) {
                            toggleCategoryEnabled(category.id)
                            if (isActive) {
                              const nextEnabled = builderCategories.find(item => item.id !== category.id && item.enabled)
                              if (nextEnabled) setActiveId(nextEnabled.id)
                            }
                            return
                          }

                          toggleCategoryEnabled(category.id)
                          setActiveId(category.id)
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

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'questions', label: 'Frågor' },
                  { id: 'setup', label: 'Upplägg' },
                  { id: 'send', label: 'Skicka' },
                  { id: 'data', label: 'Data' },
                ].map(tab => {
                  const active = editorTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditorTab(tab.id as 'questions' | 'setup' | 'send' | 'data')}
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        border: `1px solid ${active ? 'rgba(14,14,12,0.88)' : 'var(--border)'}`,
                        background: active ? 'rgba(14,14,12,0.92)' : 'rgba(14,14,12,0.03)',
                        color: active ? '#fff' : 'var(--text-2)',
                        padding: '9px 12px',
                        fontSize: 12.5,
                        fontWeight: active ? 700 : 600,
                        cursor: 'pointer',
                        boxShadow: active ? '0 10px 24px rgba(14,14,12,0.12)' : 'none',
                        transition: 'background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s',
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginBottom: 14, fontSize: 12, color: saveState === 'error' ? '#8e244c' : 'var(--text-3)' }}>
                {saveState === 'saving'
                  ? 'Sparar utkast…'
                  : saveState === 'saved'
                  ? 'Utkast sparat'
                  : saveState === 'error'
                  ? 'Autosave misslyckades.'
                  : hasUnsavedChanges
                  ? 'Osparade ändringar'
                  : 'Alla ändringar sparade'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {editorTab === 'setup' && (
                  <>
                    <div style={{ display: 'grid', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Upplägget
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => resetBuilder()} style={secondaryButtonStyle}>
                          Skapa nytt
                        </button>
                        <button type="button" onClick={() => setShowTemplatePicker(current => !current)} style={secondaryButtonStyle}>
                          {showTemplatePicker ? 'Stäng tidigare' : 'Öppna tidigare'}
                        </button>
                        <button type="button" onClick={() => void saveTemplate('draft')} disabled={saving || sending || Boolean(loadingTemplateId)} style={primaryButtonStyle(saving || sending || Boolean(loadingTemplateId))}>
                          {saving ? 'Sparar…' : saveState === 'saved' ? 'Sparat' : saveState === 'error' ? 'Spara igen' : 'Spara upplägg'}
                        </button>
                      </div>

                      {currentTemplateId && !showTemplatePicker && (
                        <div style={editorSectionStyle}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {templates.find(template => template.id === currentTemplateId)?.name || templateName}
                          </div>
                        </div>
                      )}

                      {showTemplatePicker && (
                        <div style={editorSectionStyle}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Tidigare discovery</div>

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

                    <div style={{ ...editorSectionStyle, marginTop: -6, marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
                        Ladda ett rekommenderat grundpaket.
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => applyAudienceDefaults(audienceMode)}
                          style={secondaryButtonStyle}
                        >
                          Ladda rekommenderade frågor
                        </button>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          Ledarskap, change management, AI readiness och vision.
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {editorTab === 'send' && (
                <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Skicka underlag
                  </div>

                  <Field label="Svarsläge">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {([
                        { id: 'named', label: 'Personliga länkar', desc: 'En länk per person och namn i datan.' },
                        { id: 'anonymous', label: 'Anonym länk', desc: 'En delbar länk utan namn i datan.' },
                      ] as Array<{ id: DiscoveryResponseMode; label: string; desc: string }>).map(option => {
                        const active = responseMode === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setResponseMode(option.id)}
                            style={{
                              borderRadius: 999,
                              border: '1px solid var(--border)',
                              borderColor: active ? 'var(--accent)' : 'var(--border)',
                              background: active ? 'var(--accent-dim)' : 'var(--surface)',
                              color: active ? 'var(--accent)' : 'var(--text-2)',
                              padding: '9px 14px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              cursor: 'pointer',
                            }}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                      {responseMode === 'anonymous'
                        ? 'En länk för hela gruppen.'
                        : 'En personlig länk per mottagare.'}
                    </div>
                  </Field>

                  <Field label="Organisation eller kund">
                    <input
                      value={clientOrganisation}
                      onChange={event => setClientOrganisation(event.target.value)}
                      placeholder="Till exempel Acme AB"
                      style={editorInputStyle}
                    />
                  </Field>

                  {responseMode === 'named' ? (
                    <Field label="Mottagare och kontaktpersoner">
                      <textarea
                        value={recipientsInput}
                        onChange={event => setRecipientsInput(event.target.value)}
                        rows={6}
                        placeholder={'Anna Andersson, anna@bolag.se\nErik Eriksson <erik@bolag.se>'}
                        style={{ ...editorInputStyle, minHeight: 128, resize: 'vertical' }}
                      />
                    </Field>
                  ) : (
                    <div style={{
                      ...editorSectionStyle,
                      display: 'grid',
                      gap: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                          Delbar anonym länk
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {[
                          '1. Skapa länken för vald kund eller organisation.',
                          '2. Dela den där gruppen redan kommunicerar.',
                          '3. Följ svaren i Data.',
                        ].map(step => (
                          <div key={step} style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void sendTemplate()}
                    disabled={sending}
                    style={primaryButtonStyle(sending)}
                  >
                    {sending ? 'Skickar…' : responseMode === 'anonymous' ? 'Skapa anonym länk' : 'Skicka underlag'}
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
                        {responseMode === 'anonymous'
                          ? 'Den anonyma länken är klar'
                          : sendFailureCount > 0
                          ? `${sendSuccessCount} skickades, ${sendFailureCount} gick inte fram`
                          : `${sendSuccessCount} mottagare fick utskicket`}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: sendFailureCount > 0 ? '#9a3412' : '#166534' }}>
                        {responseMode === 'anonymous'
                          ? 'Kopiera länken nedan och dela den med gruppen eller kunden. Den kan användas av flera personer.'
                          : sendFailureCount > 0
                          ? 'Se status per mottagare nedan och försök igen för dem som inte fick mejlet.'
                          : 'Discovery-länkarna är nu utskickade och du kan följa svaren under inkomna svar.'}
                      </div>
                    </div>
                  )}

                  {sendResults && sendResults.length > 0 && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {responseMode === 'anonymous' ? 'Länk och status' : 'Status per mottagare'}
                      </div>
                      {sendResults.map(result => (
                        <div key={result.sessionId} style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ color: 'var(--text)' }}>{result.label || result.email}</span>
                            <span style={{ color: result.ok ? '#166534' : '#8e244c' }}>
                              {result.ok ? (responseMode === 'anonymous' ? 'Klar' : 'Skickat') : (result.reason || 'Misslyckades')}
                            </span>
                          </div>
                          {responseMode === 'anonymous' && result.url && (
                            <div style={{
                              borderRadius: 12,
                              border: '1px solid var(--border)',
                              background: '#fff',
                              padding: '12px',
                              display: 'grid',
                              gap: 10,
                            }}>
                              <div style={{
                                fontSize: 12,
                                lineHeight: 1.55,
                                color: 'var(--text-2)',
                                wordBreak: 'break-all',
                              }}>
                                {result.url}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
                                  Dela länken i det sammanhang där gruppen redan kommunicerar.
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void copyShareUrl(result.url!)}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: '1px solid var(--border)',
                                    background: copiedShareUrl === result.url ? 'rgba(198,35,104,0.08)' : 'var(--surface)',
                                    color: copiedShareUrl === result.url ? 'var(--accent)' : 'var(--text-2)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {copiedShareUrl === result.url ? 'Kopierad' : 'Kopiera länk'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {editorTab === 'questions' && (
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
                    <div key={`${activeCategory.id}-editor-${questionIndex}`} style={questionEditorCardStyle}>
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
                )}

                {editorTab === 'data' && (
                  <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Data
                    </div>
                    {!currentTemplateId ? (
                      <div style={dataPanelStyle}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          Spara upplägget först
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                          Datavyn bygger på ett sparat discovery-upplägg. Spara eller öppna ett tidigare upplägg för att se inkomna svar här.
                        </div>
                      </div>
                    ) : (
                      <>
                        <Field label="Visa">
                          <select
                            value={dataStatusFilter}
                            onChange={event => setDataStatusFilter(event.target.value as 'all' | 'submitted' | 'pending')}
                            style={editorInputStyle}
                          >
                            <option value="all">Alla mottagare</option>
                            <option value="submitted">Bara besvarade</option>
                            <option value="pending">Bara väntande</option>
                          </select>
                        </Field>

                        <Field label="Sök">
                          <input
                            value={dataQuery}
                            onChange={event => setDataQuery(event.target.value)}
                            placeholder="Namn, e-post eller kund"
                            style={editorInputStyle}
                          />
                        </Field>

                        <Field label="Tema">
                          <select
                            value={selectedDataSectionIdOrDefault}
                            onChange={event => setSelectedDataSectionId(event.target.value)}
                            style={editorInputStyle}
                          >
                            <option value="all">Alla teman</option>
                            {dataThemeCards.map(section => (
                              <option key={section.id} value={section.id}>{section.label}</option>
                            ))}
                          </select>
                        </Field>

                        <div style={dataPanelStyle}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                            Datavyn till höger
                          </div>
                          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                            Här filtrerar du urvalet. Högersidan visar överblick, temakort och råsvar för det sparade discoveryt.
                          </div>
                          <Link href="/dashboard/discovery/responses" style={responsesLinkStyle}>
                            Öppna alla inkomna svar
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {editorTab === 'data' ? (
            <DiscoveryDataCanvas
              currentTemplateId={currentTemplateId}
              loading={dataLoading}
              error={dataError}
              templateName={templateName}
              overview={dataOverview}
              themeCards={dataThemeCards}
              rawSessions={rawDataSessions}
              customerGroups={customerGroups}
              selectedSessionId={selectedDataScope}
              onSelectSession={setSelectedDataSessionId}
              selectedSectionId={selectedDataSectionIdOrDefault}
              onSelectSection={setSelectedDataSectionId}
              selectedAnalysisLens={selectedAnalysisLens}
              onSelectAnalysisLens={setSelectedAnalysisLens}
              onRunAnalysis={runAnalysis}
              analysisPayload={analysisPayload}
              analysisUpdatedAt={analysisUpdatedAt}
              analysisLoading={analysisLoading}
              analysisError={analysisError}
              analysisCached={analysisCached}
              analysisStatus={analysisStatus}
            />
          ) : (
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
                Tack. Svaren är mottagna.
              </div>
            )}
              </div>
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  )
}

function DiscoveryDataCanvas({
  currentTemplateId,
  loading,
  error,
  templateName,
  overview,
  themeCards,
  rawSessions,
  customerGroups,
  selectedSessionId,
  onSelectSession,
  selectedSectionId,
  onSelectSection,
  selectedAnalysisLens,
  onSelectAnalysisLens,
  onRunAnalysis,
  analysisPayload,
  analysisUpdatedAt,
  analysisLoading,
  analysisError,
  analysisCached,
  analysisStatus,
}: {
  currentTemplateId: string | null
  loading: boolean
  error: string | null
  templateName: string
  overview: {
    invitedCount: number
    submittedCount: number
    pendingCount: number
    responseRate: number
    latestSubmittedAt: string | null
    strongSignalCount: number
    splitCount: number
  }
  themeCards: Array<{
    id: string
    label: string
    description: string
    questionCount: number
    respondentCount: number
    coveragePercent: number
    signalLabel: string
    splitLabel: string
    excerpt: string
  }>
  rawSessions: Array<{
    id: string
    clientName: string
    clientEmail: string
    clientOrganisation: string | null
    responseMode?: DiscoveryResponseMode
    respondentCount?: number
    status: 'pending' | 'submitted'
    createdAt: string
    submittedAt: string | null
    sectionResponses: Array<{
      sectionId: string
      answeredCount: number
      excerpts: string[]
    }>
  }>
  customerGroups: Array<{
    key: string
    label: string
    respondentCount: number
    latestSubmittedAt: string | null
    responseMode: DiscoveryResponseMode | 'mixed'
    sessions: Array<{
      id: string
      clientName: string
      clientEmail: string
      clientOrganisation: string | null
      responseMode?: DiscoveryResponseMode
      respondentCount?: number
      status: 'pending' | 'submitted'
      createdAt: string
      submittedAt: string | null
      sectionResponses: Array<{
        sectionId: string
        answeredCount: number
        excerpts: string[]
      }>
    }>
  }>
  selectedSessionId: string
  onSelectSession: (value: string) => void
  selectedSectionId: string
  onSelectSection: (value: string) => void
  selectedAnalysisLens: DiscoveryAnalysisLens
  onSelectAnalysisLens: (value: DiscoveryAnalysisLens) => void
  onRunAnalysis: (regenerate?: boolean) => void
  analysisPayload: DiscoveryAnalysisPayload | null
  analysisUpdatedAt: string | null
  analysisLoading: boolean
  analysisError: string | null
  analysisCached: boolean
  analysisStatus: DiscoveryAiStatus | null
}) {
  const [dataSurface, setDataSurface] = useState<'overview' | 'themes' | 'perspectives' | 'insights'>('overview')
  const selectedCustomerGroup = selectedSessionId.startsWith('customer:')
    ? customerGroups.find(group => `customer:${group.key}` === selectedSessionId) || null
    : null
  const executiveTimeline = useMemo(() => {
    const sessions = [...(selectedCustomerGroup?.sessions || [])]
      .sort((a, b) => (a.submittedAt || a.createdAt).localeCompare(b.submittedAt || b.createdAt))

    return sessions.slice(-6).map((session, index, arr) => {
      const total = session.sectionResponses.reduce((sum, item) => sum + item.answeredCount, 0)
      const maxAnswered = Math.max(...arr.map(item => item.sectionResponses.reduce((sum, part) => sum + part.answeredCount, 0)), 1)
      return {
        id: session.id,
        label: session.clientOrganisation || session.clientName,
        value: total,
        bar: Math.max(18, Math.round((total / maxAnswered) * 100)),
        date: session.submittedAt || session.createdAt,
        status: session.status,
      }
    })
  }, [selectedCustomerGroup])

  const perspectiveCards = useMemo(() => {
    const strongRatio = themeCards.length > 0 ? dataThemeRatio(overview.strongSignalCount, themeCards.length) : 0
    const splitRatio = themeCards.length > 0 ? dataThemeRatio(overview.splitCount, themeCards.length) : 0
    const recentActivityBoost = overview.latestSubmittedAt
      ? Math.max(20, 100 - Math.min(80, Math.floor((Date.now() - new Date(overview.latestSubmittedAt).getTime()) / 86400000) * 12))
      : 18

    return [
      {
        id: 'readiness',
        label: 'Beredskap',
        score: clampScore(Math.round(overview.responseRate * 0.55 + strongRatio * 0.35 + recentActivityBoost * 0.1)),
        tone: 'strong' as const,
        summary: 'Hur moget materialet ser ut för nästa steg.',
      },
      {
        id: 'alignment',
        label: 'Samstämmighet',
        score: clampScore(Math.round(strongRatio * 0.6 + (100 - splitRatio) * 0.4)),
        tone: 'calm' as const,
        summary: 'Hur tydligt svaren pekar i samma riktning.',
      },
      {
        id: 'friction',
        label: 'Friktion',
        score: clampScore(Math.round(splitRatio * 0.65 + (overview.pendingCount > 0 ? 20 : 8))),
        tone: 'warning' as const,
        summary: 'Var perspektiv skiljer sig eller fortfarande känns oklara.',
      },
      {
        id: 'momentum',
        label: 'Momentum',
        score: clampScore(Math.round(overview.responseRate * 0.45 + recentActivityBoost * 0.55)),
        tone: 'accent' as const,
        summary: 'Hur levande och aktuellt underlaget känns just nu.',
      },
    ]
  }, [overview, themeCards])

  const insightHighlights = useMemo(() => {
    if (analysisPayload) {
      return [
        ...analysisPayload.observations.slice(0, 2).map(item => ({
          title: item.title,
          detail: item.detail,
          tone: 'strong' as const,
        })),
        ...analysisPayload.differences.slice(0, 2).map(item => ({
          title: item.title,
          detail: item.detail,
          tone: 'warning' as const,
        })),
      ].slice(0, 4)
    }

    return themeCards
      .filter(card => card.respondentCount > 0)
      .sort((a, b) => b.coveragePercent - a.coveragePercent)
      .slice(0, 4)
      .map(card => ({
        title: card.label,
        detail: card.excerpt || `${card.respondentCount} svar · ${card.coveragePercent}% täckning`,
        tone: card.splitLabel ? 'warning' as const : card.signalLabel === 'Tydlig signal' ? 'strong' as const : 'calm' as const,
      }))
  }, [analysisPayload, themeCards])

  const strongestTheme = themeCards
    .filter(card => card.respondentCount > 0)
    .sort((a, b) => b.coveragePercent - a.coveragePercent)[0] || null

  const mostSplitTheme = themeCards
    .filter(card => card.splitLabel)
    .sort((a, b) => b.respondentCount - a.respondentCount)[0] || null

  if (!currentTemplateId) {
    return (
      <section style={{ minWidth: 0 }}>
        <div style={dataCanvasShellStyle}>
          <div style={dataHeroStyle}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
              Data
            </div>
            <h2 style={dataHeroTitleStyle}>Spara eller öppna ett upplägg först</h2>
            <p style={dataHeroTextStyle}>
              När discoveryt är sparat kan datavyn visa svarsläge, temakort och råsvar för just det upplägget.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section style={{ minWidth: 0 }}>
        <div style={{ ...dataCanvasShellStyle, display: 'grid', placeItems: 'center', minHeight: 460 }}>
          <PageLoader />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section style={{ minWidth: 0 }}>
        <div style={{ ...dataCanvasShellStyle, padding: 28 }}>
          <InlineError text={error} />
        </div>
      </section>
    )
  }

  if (overview.submittedCount === 0) {
    return (
      <section style={{ minWidth: 0 }}>
        <div style={dataCanvasShellStyle}>
          <div style={dataHeroStyle}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
              Data
            </div>
            <h2 style={dataHeroTitleStyle}>Inga svar ännu</h2>
            <p style={dataHeroTextStyle}>
              Datavyn fylls först när discoveryt har skickats ut och minst en person har svarat. Tills dess är det här en tom arbetsyta.
            </p>
          </div>

          <div style={{ padding: '22px 24px 26px', display: 'grid', gap: 18 }}>
            <section style={dataPanelStyle}>
              <div style={dataSectionLabelStyle}>När svar börjar komma in</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7 }}>
                Här kommer du kunna välja kundspår, se tematiska signaler och generera AI-analys på det material som faktiskt har besvarats.
              </div>
            </section>
          </div>
        </div>
      </section>
    )
  }

  if (selectedSessionId === 'none') {
    return (
      <section style={{ minWidth: 0 }}>
        <div style={dataCanvasShellStyle}>
          <div style={dataHeroStyle}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
              Data
            </div>
            <h2 style={dataHeroTitleStyle}>Välj ett kundspår</h2>
            <p style={dataHeroTextStyle}>
              Data är kopplat till faktiska kundsvar. Välj först en kund för att läsa just det material som har kommit in därifrån.
            </p>
          </div>

          <div style={{ padding: '22px 24px 26px', display: 'grid', gap: 18 }}>
            <section style={dataPanelStyle}>
              <div style={dataSectionLabelStyle}>Öppna data för</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7 }}>
                Varje discovery ska läsas separat per kundspår. Välj den kund du vill analysera i stället för att blanda ihop flera spår i samma vy.
              </div>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {customerGroups.map(group => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => onSelectSession(`customer:${group.key}`)}
                      style={dataCustomerCardStyle}
                    >
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: group.responseMode === 'anonymous' ? 'rgba(30,14,46,0.08)' : 'rgba(198,35,104,0.08)',
                            color: group.responseMode === 'anonymous' ? 'var(--text-2)' : 'var(--accent)',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}>
                            {group.responseMode === 'anonymous' ? 'Anonymt' : group.responseMode === 'mixed' ? 'Blandat' : 'Namnkopplat'}
                          </div>
                          {group.latestSubmittedAt && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                              {formatDataDateTime(group.latestSubmittedAt)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          {group.label}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.6 }}>
                          {group.responseMode === 'anonymous'
                            ? `${group.respondentCount} anonyma svar`
                            : `${group.respondentCount} svar · ${group.latestSubmittedAt ? `senast ${formatDataDateTime(group.latestSubmittedAt)}` : 'besvarat'}`}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                            <strong style={{ color: 'var(--text)' }}>{group.sessions.length}</strong> utskicksspår
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                            <strong style={{ color: 'var(--text)' }}>{group.respondentCount}</strong> inkomna svar
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={{ minWidth: 0 }}>
      <div style={dataCanvasShellStyle}>
        <div style={dataHeroStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600, marginBottom: 10 }}>
                Data
              </div>
              <h2 style={dataHeroTitleStyle}>{templateName}</h2>
              <p style={dataHeroTextStyle}>
                Läs svarsläge, tematiska signaler och råsvar för ett valt kundspår i discoveryt.
              </p>
            </div>
            <Link href="/dashboard/discovery/responses" style={{ ...responsesLinkStyle, background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
              Inkomna svar
            </Link>
          </div>
        </div>

        <div style={{ padding: '22px 24px 26px', display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onSelectSession('none')}
              style={inactiveDataTabButtonStyle}
            >
              ← Tillbaka till kunder
            </button>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              {customerGroups.find(group => `customer:${group.key}` === selectedSessionId)?.label
                || 'Vald kund'}
            </div>
          </div>

          {selectedCustomerGroup && (
            <section style={{
              ...dataPanelStyle,
              background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
              display: 'grid',
              gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={dataSectionLabelStyle}>Vald kund</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.05, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                    {selectedCustomerGroup.label}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 999,
                  background: selectedCustomerGroup.responseMode === 'anonymous' ? 'rgba(30,14,46,0.08)' : 'rgba(198,35,104,0.08)',
                  color: selectedCustomerGroup.responseMode === 'anonymous' ? 'var(--text-2)' : 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {selectedCustomerGroup.responseMode === 'anonymous' ? 'Anonymt läge' : selectedCustomerGroup.responseMode === 'mixed' ? 'Blandat läge' : 'Namnkopplat läge'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div style={customerMetricCardStyle}>
                  <div style={customerMetricLabelStyle}>Inkomna svar</div>
                  <div style={customerMetricValueStyle}>{selectedCustomerGroup.respondentCount}</div>
                </div>
                <div style={customerMetricCardStyle}>
                  <div style={customerMetricLabelStyle}>Utskicksspår</div>
                  <div style={customerMetricValueStyle}>{selectedCustomerGroup.sessions.length}</div>
                </div>
                <div style={customerMetricCardStyle}>
                  <div style={customerMetricLabelStyle}>Senaste aktivitet</div>
                  <div style={{ ...customerMetricValueStyle, fontSize: 17 }}>
                    {selectedCustomerGroup.latestSubmittedAt ? formatDataDateTime(selectedCustomerGroup.latestSubmittedAt) : 'Ingen ännu'}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {customerGroups.map(group => (
              <button
                key={group.key}
                type="button"
                onClick={() => onSelectSession(`customer:${group.key}`)}
                style={selectedSessionId === `customer:${group.key}` ? activeDataTabStyle : inactiveDataTabButtonStyle}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div style={summaryGridStyle}>
            <DataSummaryCard label="Inbjudna" value={`${overview.invitedCount}`} sublabel="För vald kund" />
            <DataSummaryCard label="Svar inkomna" value={`${overview.submittedCount}`} sublabel="För vald kund" />
            <DataSummaryCard label="Svarsfrekvens" value={`${overview.responseRate}%`} sublabel={overview.pendingCount > 0 ? `${overview.pendingCount} väntar fortfarande` : 'Alla har svarat'} />
            <DataSummaryCard label="Senaste svar" value={overview.latestSubmittedAt ? formatDataDateTime(overview.latestSubmittedAt) : 'Inga ännu'} sublabel="Senaste aktivitet" />
            <DataSummaryCard label="Tydliga teman" value={`${overview.strongSignalCount}`} sublabel="Med stark signal" />
            <DataSummaryCard label="Olika perspektiv" value={`${overview.splitCount}`} sublabel="Teman med splittring" />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'overview', label: 'Executive overview' },
              { id: 'themes', label: 'Teman' },
              { id: 'perspectives', label: 'Perspektiv' },
              { id: 'insights', label: 'Insikter' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDataSurface(item.id as 'overview' | 'themes' | 'perspectives' | 'insights')}
                style={dataSurface === item.id ? activeDataTabStyle : inactiveDataTabButtonStyle}
              >
                {item.label}
              </button>
            ))}
          </div>

          {dataSurface === 'overview' && (
            <section style={dataPanelStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: 18, alignItems: 'start' }}>
                <div style={executiveHeroCardStyle}>
                  <div style={dataSectionLabelStyle}>Executive overview</div>
                  <div style={executiveHeadlineStyle}>
                    {strongestTheme
                      ? `${selectedCustomerGroup?.label || 'Kunden'} visar tydligast signal i ${strongestTheme.label.toLowerCase()}.`
                      : 'Materialet börjar forma en första riktning.'}
                  </div>
                  <div style={executiveNarrativeStyle}>
                    {mostSplitTheme
                      ? `Det starkaste underlaget finns i ${strongestTheme?.label.toLowerCase() || 'de tydligaste temana'}, medan ${mostSplitTheme.label.toLowerCase()} sticker ut som området där perspektiven skiljer sig mest.`
                      : `Underlaget pekar främst mot ${strongestTheme?.label.toLowerCase() || 'de teman som redan har svar'}, utan tydlig splittring ännu.`}
                  </div>

                  <div style={executiveTimelineGridStyle}>
                    {executiveTimeline.length > 0 ? executiveTimeline.map(item => (
                      <div key={item.id} style={timelineCardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{truncate(item.label, 26)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{formatDataDateTime(item.date)}</div>
                        </div>
                        <div style={timelineTrackStyle}>
                          <div style={{ ...timelineFillStyle, width: `${item.bar}%`, background: item.status === 'submitted' ? 'linear-gradient(90deg,#1f6b53 0%, #3aa07e 100%)' : 'linear-gradient(90deg,#a16207 0%, #f59e0b 100%)' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{item.value} svarspunkter</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: item.status === 'submitted' ? '#166534' : '#9a3412' }}>
                            {item.status === 'submitted' ? 'Besvarad' : 'Väntar'}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Inga tidssteg att visa ännu.</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {perspectiveCards.map(card => (
                    <div key={card.id} style={perspectiveMetricCardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={dataSectionLabelStyle}>{card.label}</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)', marginTop: 6 }}>
                            {card.summary}
                          </div>
                        </div>
                        <div style={{ ...perspectiveScoreStyle, color: perspectiveToneColor(card.tone) }}>
                          {card.score}
                        </div>
                      </div>
                      <div style={timelineTrackStyle}>
                        <div style={{ ...timelineFillStyle, width: `${card.score}%`, background: perspectiveToneBackground(card.tone) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {dataSurface === 'themes' && (
            <section style={dataPanelStyle}>
              <div>
                <div style={dataSectionLabelStyle}>Theme heatmap</div>
                <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 4 }}>
                  En ledningsläsning av teman, täckning, signal och splittring för vald kund.
                </div>
              </div>

              <div style={heatmapShellStyle}>
                <div style={heatmapHeaderRowStyle}>
                  <div style={heatmapThemeHeaderStyle}>Tema</div>
                  <div style={heatmapMetricHeaderStyle}>Täckning</div>
                  <div style={heatmapMetricHeaderStyle}>Signal</div>
                  <div style={heatmapMetricHeaderStyle}>Split</div>
                  <div style={heatmapMetricHeaderStyle}>Insikt</div>
                </div>
                {themeCards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectSection(selectedSectionId === card.id ? 'all' : card.id)}
                    style={{ ...heatmapRowStyle, borderColor: selectedSectionId === card.id ? 'rgba(198,35,104,0.26)' : 'rgba(14,14,12,0.08)' }}
                  >
                    <div style={heatmapThemeCellStyle}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{card.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{card.questionCount} frågor · {card.respondentCount} svar</div>
                    </div>
                    <HeatCell value={card.coveragePercent} label={`${card.coveragePercent}%`} tone={card.coveragePercent >= 70 ? 'strong' : card.coveragePercent >= 35 ? 'accent' : 'calm'} />
                    <HeatCell value={themeSignalScore(card.signalLabel)} label={card.signalLabel} tone={card.signalLabel === 'Tydlig signal' ? 'strong' : card.signalLabel === 'Viss signal' ? 'accent' : 'calm'} />
                    <HeatCell value={card.splitLabel ? 72 : 18} label={card.splitLabel || 'Låg'} tone={card.splitLabel ? 'warning' : 'calm'} />
                    <div style={heatmapInsightCellStyle}>
                      {card.excerpt ? truncate(card.excerpt, 110) : card.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {dataSurface === 'perspectives' && (
            <section style={dataPanelStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={dataSectionLabelStyle}>Perspektiv</div>
                  <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 4 }}>
                    Läs samma material genom konsult- och ledningsperspektiv i stället för bara per fråga.
                  </div>
                </div>
              </div>

              <div style={perspectiveGridStyle}>
                {perspectiveCards.map(card => (
                  <div key={card.id} style={perspectivePanelCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={dataSectionLabelStyle}>{card.label}</div>
                        <div style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.03em', fontFamily: 'var(--font-display)', color: 'var(--text)', marginTop: 6 }}>
                          {card.score}/100
                        </div>
                      </div>
                      <div style={{ ...perspectiveBadgeStyle, color: perspectiveToneColor(card.tone), background: perspectiveToneSurface(card.tone) }}>
                        {card.tone === 'strong' ? 'Starkt' : card.tone === 'warning' ? 'Att följa upp' : card.tone === 'accent' ? 'I rörelse' : 'Stabilt'}
                      </div>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
                      {card.summary}
                    </div>
                    <div style={timelineTrackStyle}>
                      <div style={{ ...timelineFillStyle, width: `${card.score}%`, background: perspectiveToneBackground(card.tone) }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                      {card.id === 'readiness'
                        ? `${overview.submittedCount} svar och ${overview.strongSignalCount} teman med tydlig signal ligger bakom läsningen.`
                        : card.id === 'alignment'
                          ? `${overview.splitCount > 0 ? `${overview.splitCount} teman visar splittring.` : 'Materialet visar låg synlig splittring än så länge.'}`
                          : card.id === 'friction'
                            ? `${mostSplitTheme ? `${mostSplitTheme.label} är tydligaste friktionsyta.` : 'Ingen stark friktionsyta sticker ut ännu.'}`
                            : `${overview.latestSubmittedAt ? `Senaste svar ${formatDataDateTime(overview.latestSubmittedAt)}.` : 'Ingen ny aktivitet ännu.'}`}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {dataSurface === 'insights' && (
            <section style={dataPanelStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={dataSectionLabelStyle}>Insikter</div>
                  <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 4 }}>
                    Ett mer beslutsnära lager ovanpå teman och råsvar.
                  </div>
                </div>
                {!analysisPayload && (
                  <button type="button" onClick={() => onRunAnalysis(false)} disabled={analysisLoading} style={primaryButtonStyle(analysisLoading)}>
                    {analysisLoading ? 'Analyserar…' : 'Generera första analysen'}
                  </button>
                )}
              </div>

              <div style={insightGridStyle}>
                {insightHighlights.map((item, index) => (
                  <div key={`${item.title}-${index}`} style={{ ...insightCardStyle, borderColor: insightToneBorder(item.tone), background: insightToneSurface(item.tone) }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={dataSectionLabelStyle}>{item.tone === 'warning' ? 'Att följa upp' : item.tone === 'strong' ? 'Tydlig signal' : 'Läsning'}</div>
                      <div style={{ ...perspectiveBadgeStyle, color: insightToneColor(item.tone), background: '#fff' }}>
                        {index + 1}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-2)' }}>{item.detail}</div>
                  </div>
                ))}
              </div>

              {analysisPayload && (
                <div style={executiveNarrativePanelStyle}>
                  <div style={dataSectionLabelStyle}>AI-tolkning</div>
                  <div style={{ fontSize: 18, lineHeight: 1.45, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                    {analysisPayload.summary}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                    {analysisCached ? 'Senast hämtad från cache' : 'Nygenererad'}{analysisUpdatedAt ? ` · ${formatDataDateTime(analysisUpdatedAt)}` : ''}{` · ${analysisPayload.scope.respondent_count} svar`}
                  </div>
                </div>
              )}
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, 0.75fr)', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <section style={dataPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div>
                      <div style={dataSectionLabelStyle}>Teman</div>
                      <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
                      Temakorten hjälper dig hitta var just den här kundens discovery ger tydliga signaler och var det fortfarande finns olika perspektiv.
                      </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {themeCards.map(card => {
                    const active = selectedSectionId === card.id
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onSelectSection(active ? 'all' : card.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: `1px solid ${active ? 'rgba(198,35,104,0.26)' : 'var(--border)'}`,
                          background: active ? 'linear-gradient(180deg,rgba(198,35,104,0.08) 0%,rgba(198,35,104,0.03) 100%)' : 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
                          padding: '18px 18px 16px',
                          display: 'grid',
                          gap: 12,
                          cursor: 'pointer',
                          boxShadow: active ? '0 10px 24px rgba(198,35,104,0.08)' : '0 1px 0 rgba(15,23,42,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{card.label}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                              {card.questionCount} frågor
                            </div>
                          </div>
                          <div style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: card.signalLabel === 'Tydlig signal' ? '#166534' : card.signalLabel === 'Inga svar ännu' ? 'var(--text-3)' : 'var(--accent)',
                          }}>
                            {card.signalLabel}
                          </div>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-3)' }}>
                          {card.respondentCount} svar i urvalet · {card.coveragePercent}% täckning
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(14,14,12,0.08)', overflow: 'hidden' }}>
                          <div style={{ width: `${card.coveragePercent}%`, height: '100%', borderRadius: 999, background: card.signalLabel === 'Tydlig signal' ? '#166534' : 'var(--accent)' }} />
                        </div>
                        {card.splitLabel && (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9a3412' }}>
                            {card.splitLabel}
                          </div>
                        )}
                        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
                          {card.excerpt ? truncate(card.excerpt, 120) : card.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section style={dataPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={dataSectionLabelStyle}>Råsvar</div>
                      <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
                      Råsvaren är bevislagret bakom sammanfattningen för den valda kunden.
                      </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {rawSessions.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '6px 2px' }}>
                      Inga svar matchar ditt nuvarande urval ännu.
                    </div>
                  ) : rawSessions.map(session => {
                    const selectedResponse = selectedSectionId === 'all'
                      ? session.sectionResponses.find(item => item.excerpts.length > 0)
                      : session.sectionResponses.find(item => item.sectionId === selectedSectionId)

                    return (
                      <div key={session.id} style={{
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        padding: '14px 16px',
                        display: 'grid',
                        gap: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                              {session.clientOrganisation || session.clientName}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                              {session.responseMode === 'anonymous'
                                ? `${session.respondentCount || 0} anonyma svar · ${session.status === 'submitted' && session.submittedAt ? `Senaste svar ${formatDataDateTime(session.submittedAt)}` : `Skapad ${formatDataDateTime(session.createdAt)}`}`
                                : `${session.clientEmail} · ${session.status === 'submitted' && session.submittedAt ? `Besvarad ${formatDataDateTime(session.submittedAt)}` : `Skickad ${formatDataDateTime(session.createdAt)}`}`}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: session.status === 'submitted' ? '#166534' : '#9a3412',
                            background: session.status === 'submitted' ? '#f0fdf4' : '#fff7ed',
                            border: session.status === 'submitted' ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                            borderRadius: 999,
                            padding: '5px 9px',
                          }}>
                            {session.status === 'submitted' ? 'Besvarad' : 'Väntar'}
                          </div>
                        </div>

                        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                          {selectedResponse?.excerpts?.[0]
                            ? truncate(selectedResponse.excerpts[0], 190)
                            : session.status === 'submitted'
                              ? 'Det här svaret innehåller främst val eller skalfrågor i det valda temat.'
                              : 'Inget svar har kommit in ännu.'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                            {session.sectionResponses.reduce((sum, item) => sum + item.answeredCount, 0)} besvarade frågor i urvalet
                          </div>
                          <Link href={`/dashboard/discovery/responses/${session.id}`} style={responsesLinkStyle}>
                            Öppna svar
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <aside style={{ display: 'grid', gap: 18 }}>
              <section style={dataPanelStyle}>
                <div style={dataSectionLabelStyle}>Analysvyer</div>
                <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 4 }}>
                  AI-analysen använder samma urval som datavyn och ska hjälpa dig läsa materialet ur ett tydligt perspektiv utan att tappa kontakten med råsvaren.
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                  {discoveryAnalysisLenses.map(label => {
                    const active = selectedAnalysisLens === label
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onSelectAnalysisLens(label)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 12,
                          border: `1px solid ${active ? 'rgba(198,35,104,0.28)' : 'var(--border)'}`,
                          background: active ? 'rgba(198,35,104,0.06)' : 'rgba(14,14,12,0.03)',
                          padding: '12px 13px',
                          fontSize: 13,
                          color: active ? 'var(--accent)' : 'var(--text)',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div style={{
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'rgba(14,14,12,0.03)',
                  padding: '12px 13px',
                  display: 'grid',
                  gap: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    AI-status
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>
                    {analysisStatus?.configured.openai
                      ? 'OPENAI_API_KEY finns i miljön. Discovery är förberett för att växla till OpenAI när vi kopplar in routen.'
                      : analysisStatus?.currentProvider === 'anthropic'
                        ? 'ANTHROPIC_API_KEY finns i miljön och används nu av Discovery-analysen.'
                        : analysisStatus?.configured.anthropic
                          ? 'ANTHROPIC_API_KEY finns i miljön. Discovery är förberett för att växla till Anthropic när vi kopplar in routen.'
                        : 'Nästa analysmotor är inte konfigurerad ännu. Lägg in OPENAI_API_KEY eller ANTHROPIC_API_KEY i Vercel när ni vill aktivera den.'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                    Nuvarande route använder {analysisStatus?.currentProvider === 'anthropic' ? 'Anthropic' : analysisStatus?.currentProvider === 'berget' ? 'Berget' : 'ingen aktiv analysprovider'}.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onRunAnalysis(false)} disabled={analysisLoading} style={primaryButtonStyle(analysisLoading)}>
                    {analysisLoading ? 'Analyserar…' : 'Generera analys'}
                  </button>
                  <button type="button" onClick={() => onRunAnalysis(true)} disabled={analysisLoading} style={secondaryButtonStyle}>
                    Generera om
                  </button>
                </div>

                {analysisError && <InlineError text={analysisError} />}

                {analysisPayload && (
                  <div style={{ display: 'grid', gap: 14, marginTop: 2 }}>
                    <div style={{ padding: '14px 14px 12px', borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(14,14,12,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          {analysisPayload.preliminary ? 'Tidiga signaler' : 'AI-tolkning'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          {analysisCached ? 'Från cache' : 'Nygenererad'}
                          {analysisUpdatedAt ? ` · ${formatDataDateTime(analysisUpdatedAt)}` : ''}
                          {` · ${analysisPayload.scope.respondent_count} svar`}
                        </div>
                      </div>
                      {analysisPayload.caution && (
                        <div style={{
                          marginBottom: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #fed7aa',
                          background: '#fff7ed',
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: '#9a3412',
                        }}>
                          {analysisPayload.caution}
                        </div>
                      )}
                      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-2)' }}>
                        {analysisPayload.summary}
                      </div>
                    </div>

                    {analysisPayload.observations.length > 0 && (
                      <AnalysisGroup title="Det som återkommer" items={analysisPayload.observations} evidence={analysisPayload.evidence} />
                    )}

                    {analysisPayload.differences.length > 0 && (
                      <AnalysisGroup title="Det som skiljer sig" items={analysisPayload.differences} evidence={analysisPayload.evidence} />
                    )}

                    {analysisPayload.uncertainties.length > 0 && (
                      <AnalysisQuestionGroup title="Det vi inte vet ännu" items={analysisPayload.uncertainties} evidence={analysisPayload.evidence} />
                    )}

                    {analysisPayload.next_questions.length > 0 && (
                      <section style={analysisBlockStyle}>
                        <div style={dataSectionLabelStyle}>Bra frågor till nästa steg</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {analysisPayload.next_questions.map(item => (
                            <div key={item} style={analysisRowStyle}>
                              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{item}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {analysisPayload.evidence.length > 0 && (
                      <section style={analysisBlockStyle}>
                        <div style={dataSectionLabelStyle}>Underlag ur svaren</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {analysisPayload.evidence.map((item, index) => (
                            <div key={`${item.theme_id}-${index}`} style={analysisRowStyle}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>
                                {item.respondent_label}
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
                                {item.excerpt}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </section>

              <section style={dataPanelStyle}>
                <div style={dataSectionLabelStyle}>Valt tema</div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {selectedSectionId === 'all'
                    ? 'Alla teman'
                    : themeCards.find(card => card.id === selectedSectionId)?.label || 'Alla teman'}
                </div>
                <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                  Klicka på ett temakort för att smalna av råsvaren och fokusera analysen. Klicka igen för att gå tillbaka till hela materialet.
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}

function DataSummaryCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '14px 16px',
      display: 'grid',
      gap: 6,
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
        {sublabel}
      </div>
    </div>
  )
}

function HeatCell({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: 'strong' | 'accent' | 'warning' | 'calm'
}) {
  return (
    <div style={heatCellShellStyle}>
      <div style={{ ...heatCellFillStyle, width: `${Math.max(8, Math.min(100, value))}%`, background: perspectiveToneBackground(tone) }} />
      <div style={{ ...heatCellLabelStyle, color: perspectiveToneColor(tone) }}>{label}</div>
    </div>
  )
}

function AnalysisEvidence({
  ids,
  evidence,
}: {
  ids: string[]
  evidence: DiscoveryAnalysisPayload['evidence']
}) {
  const relevantEvidence = evidence.filter(item => ids.includes(item.id))
  if (relevantEvidence.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      {relevantEvidence.map(item => (
        <div key={item.id} style={{
          borderRadius: 12,
          border: '1px solid rgba(14,14,12,0.08)',
          background: 'rgba(14,14,12,0.03)',
          padding: '10px 11px',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>
            {item.respondent_label}
          </div>
          <div style={{ fontSize: 12.75, lineHeight: 1.6, color: 'var(--text-2)' }}>
            {item.excerpt}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalysisGroup({
  title,
  items,
  evidence,
}: {
  title: string
  items: Array<{ title: string; detail: string; confidence: 'high' | 'medium' | 'low'; evidence_ids: string[] }>
  evidence: DiscoveryAnalysisPayload['evidence']
}) {
  return (
    <section style={analysisBlockStyle}>
      <div style={dataSectionLabelStyle}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <div key={`${item.title}-${item.detail}`} style={analysisRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: item.confidence === 'high' ? '#166534' : item.confidence === 'medium' ? '#9a3412' : 'var(--text-3)' }}>
                {confidenceLabel(item.confidence)}
              </div>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{item.detail}</div>
            <AnalysisEvidence ids={item.evidence_ids} evidence={evidence} />
          </div>
        ))}
      </div>
    </section>
  )
}

function AnalysisQuestionGroup({
  title,
  items,
  evidence,
}: {
  title: string
  items: Array<{ title: string; detail: string; evidence_ids: string[] }>
  evidence: DiscoveryAnalysisPayload['evidence']
}) {
  return (
    <section style={analysisBlockStyle}>
      <div style={dataSectionLabelStyle}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <div key={`${item.title}-${item.detail}`} style={analysisRowStyle}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{item.detail}</div>
            <AnalysisEvidence ids={item.evidence_ids} evidence={evidence} />
          </div>
        ))}
      </div>
    </section>
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

function formatDataDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Okänt datum'

  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function truncate(value: string, length: number) {
  if (value.length <= length) return value
  return `${value.slice(0, length).trim()}…`
}

function confidenceLabel(value: 'high' | 'medium' | 'low') {
  switch (value) {
    case 'high':
      return 'Hög säkerhet'
    case 'medium':
      return 'Viss säkerhet'
    default:
      return 'Tunt underlag'
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function dataThemeRatio(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function themeSignalScore(label: string) {
  switch (label) {
    case 'Tydlig signal':
      return 92
    case 'Viss signal':
      return 62
    case 'På väg':
      return 34
    default:
      return 10
  }
}

function perspectiveToneColor(tone: 'strong' | 'accent' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return '#166534'
    case 'accent':
      return 'var(--accent)'
    case 'warning':
      return '#9a3412'
    default:
      return 'var(--text-2)'
  }
}

function perspectiveToneBackground(tone: 'strong' | 'accent' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return 'linear-gradient(90deg,#166534 0%, #34d399 100%)'
    case 'accent':
      return 'linear-gradient(90deg,#c62368 0%, #f26aa0 100%)'
    case 'warning':
      return 'linear-gradient(90deg,#9a3412 0%, #f59e0b 100%)'
    default:
      return 'linear-gradient(90deg,#475569 0%, #cbd5e1 100%)'
  }
}

function perspectiveToneSurface(tone: 'strong' | 'accent' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return '#f0fdf4'
    case 'accent':
      return 'rgba(198,35,104,0.08)'
    case 'warning':
      return '#fff7ed'
    default:
      return 'rgba(14,14,12,0.04)'
  }
}

function insightToneSurface(tone: 'strong' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return '#f7fcf8'
    case 'warning':
      return '#fff8f1'
    default:
      return '#faf8fc'
  }
}

function insightToneBorder(tone: 'strong' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return '#c7eed7'
    case 'warning':
      return '#fed7aa'
    default:
      return 'rgba(14,14,12,0.08)'
  }
}

function insightToneColor(tone: 'strong' | 'warning' | 'calm') {
  switch (tone) {
    case 'strong':
      return '#166534'
    case 'warning':
      return '#9a3412'
    default:
      return 'var(--text-2)'
  }
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

const editorSectionStyle: React.CSSProperties = {
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,246,0.86))',
  padding: '16px 18px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
}

const dataPanelStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 18,
  background: 'var(--surface)',
  padding: '16px',
  display: 'grid',
  gap: 12,
}

const dataCanvasShellStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 22,
  overflow: 'hidden',
  boxShadow: '0 18px 48px rgba(16,24,40,0.06)',
}

const builderHeroStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 20,
  padding: '30px 32px',
  borderRadius: 28,
  border: '1px solid rgba(27,22,19,0.08)',
  background: [
    'radial-gradient(circle at top right, rgba(144, 96, 69, 0.18), transparent 28%)',
    'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,251,246,0.72) 100%)',
  ].join(', '),
  boxShadow: '0 26px 60px rgba(56, 39, 26, 0.08)',
}

const builderHeroEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#6b7280',
  fontWeight: 700,
  marginBottom: 12,
}

const builderHeroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(2rem, 3.1vw, 3.15rem)',
  lineHeight: 1,
  letterSpacing: '-0.045em',
  color: '#111827',
  maxWidth: 760,
}

const builderHeroTextStyle: React.CSSProperties = {
  margin: '14px 0 0',
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.7,
  color: '#4b5563',
}

const builderHeroAsideStyle: React.CSSProperties = {
  minWidth: 220,
  padding: '18px 18px 16px',
  borderRadius: 22,
  border: '1px solid rgba(27,22,19,0.08)',
  background: 'rgba(255,255,255,0.72)',
}

const builderHeroAsideLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#6b7280',
}

const builderHeroAsideValueStyle: React.CSSProperties = {
  marginTop: 10,
  fontFamily: 'var(--font-display)',
  fontSize: 24,
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
  color: '#111827',
}

const builderHeroAsideMetaStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12.5,
  lineHeight: 1.6,
  color: '#6b7280',
}

const builderSummaryStripStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 14,
}

const dataHeroStyle: React.CSSProperties = {
  background: 'var(--text)',
  color: '#fff',
  padding: '24px 24px 26px',
}

const dataHeroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(2rem, 3vw, 2.8rem)',
  lineHeight: 1.05,
  letterSpacing: '-0.03em',
  color: '#fff',
}

const dataHeroTextStyle: React.CSSProperties = {
  margin: '10px 0 0',
  maxWidth: 640,
  fontSize: 14.5,
  lineHeight: 1.7,
  color: 'rgba(255,255,255,0.74)',
}

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
}

const executiveHeroCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
  padding: '20px 20px 18px',
  display: 'grid',
  gap: 16,
}

const executiveHeadlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 30,
  lineHeight: 1.04,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
  maxWidth: 720,
}

const executiveNarrativeStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.7,
  color: 'var(--text-2)',
  maxWidth: 760,
}

const executiveTimelineGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
}

const timelineCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(14,14,12,0.08)',
  background: '#fff',
  padding: '14px 14px 12px',
  display: 'grid',
  gap: 10,
}

const timelineTrackStyle: React.CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: 'rgba(14,14,12,0.08)',
  overflow: 'hidden',
}

const timelineFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
}

const perspectiveMetricCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: '#fff',
  padding: '16px',
  display: 'grid',
  gap: 12,
}

const perspectiveScoreStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 30,
  lineHeight: 1,
  letterSpacing: '-0.04em',
}

const heatmapShellStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
  padding: '10px',
  display: 'grid',
  gap: 8,
}

const heatmapHeaderRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(3, minmax(120px, 0.45fr)) minmax(240px, 1fr)',
  gap: 8,
  padding: '0 8px 4px',
}

const heatmapRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(3, minmax(120px, 0.45fr)) minmax(240px, 1fr)',
  gap: 8,
  alignItems: 'stretch',
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 14,
  background: '#fff',
  padding: 8,
  textAlign: 'left',
  cursor: 'pointer',
}

const heatmapThemeHeaderStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const heatmapMetricHeaderStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  textAlign: 'center',
}

const heatmapThemeCellStyle: React.CSSProperties = {
  padding: '10px 10px 8px',
  display: 'grid',
  gap: 4,
  alignContent: 'center',
}

const heatmapInsightCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  background: 'rgba(14,14,12,0.03)',
  fontSize: 12.5,
  lineHeight: 1.55,
  color: 'var(--text-2)',
  display: 'grid',
  alignContent: 'center',
}

const heatCellShellStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 12,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(14,14,12,0.03)',
  minHeight: 64,
  display: 'grid',
  alignItems: 'center',
}

const heatCellFillStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  opacity: 0.18,
}

const heatCellLabelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  textAlign: 'center',
  fontSize: 12.5,
  fontWeight: 700,
  padding: '0 10px',
}

const perspectiveGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 12,
}

const perspectivePanelCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
  padding: '16px',
  display: 'grid',
  gap: 12,
}

const perspectiveBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 34,
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
}

const insightGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const insightCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(14,14,12,0.08)',
  padding: '16px',
  display: 'grid',
  gap: 10,
}

const executiveNarrativePanelStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
  padding: '18px 18px 16px',
  display: 'grid',
  gap: 10,
}

const dataSectionLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const analysisBlockStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  background: 'rgba(14,14,12,0.03)',
  padding: '14px',
  display: 'grid',
  gap: 10,
}

const analysisRowStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'var(--surface)',
  padding: '12px 13px',
}

const activeDataTabStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid rgba(198,35,104,0.26)',
  background: 'rgba(198,35,104,0.08)',
  color: 'var(--accent)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const inactiveDataTabButtonStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text-2)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const inactiveDataTabStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(250,248,246,0.88)',
  color: 'var(--text-3)',
  fontSize: 12.5,
  fontWeight: 700,
}

const dataCustomerCardStyle: React.CSSProperties = {
  textAlign: 'left',
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg,#fff 0%,#faf8fc 100%)',
  padding: '16px 16px',
  display: 'grid',
  gap: 10,
  cursor: 'pointer',
  boxShadow: '0 1px 0 rgba(15,23,42,0.02)',
}

const customerMetricCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#fff',
  padding: '14px 15px',
  display: 'grid',
  gap: 6,
}

const customerMetricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const customerMetricValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 24,
  lineHeight: 1.05,
  letterSpacing: '-0.03em',
  color: 'var(--text)',
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

const questionEditorCardStyle: React.CSSProperties = {
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,246,0.86))',
  padding: '16px 16px 14px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
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
