'use client'

import { useMemo, useState } from 'react'

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
  const [activeId, setActiveId] = useState(categories[0].id)
  const [answers, setAnswers] = useState<Record<string, CategoryState>>(() =>
    Object.fromEntries(categories.map(category => [category.id, {}]))
  )
  const [successId, setSuccessId] = useState<string | null>(null)

  const activeCategory = categories.find(category => category.id === activeId) || categories[0]

  const activeProgress = useMemo(() => {
    const count = answeredCount(activeCategory, answers[activeCategory.id] || {})
    return {
      count,
      percent: Math.round((count / activeCategory.questions.length) * 100),
    }
  }, [activeCategory, answers])

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

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--text)', color: '#fff' }}>
        <div style={{ padding: '22px 34px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 28, height: 28 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>Discovery</div>
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
            Behovsanalys
          </div>
        </div>

        <div style={{ padding: '34px 34px 58px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            inset: 'auto auto -22px 0',
            width: '100%',
            height: 42,
            background: 'var(--bg)',
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }} />
          <h1 style={{
            margin: '0 0 10px',
            maxWidth: 580,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            lineHeight: 1.16,
            letterSpacing: '-0.03em',
            position: 'relative',
            zIndex: 1,
          }}>
            Berätta vad ni <span style={{ color: 'var(--accent)' }}>behöver</span>
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 560,
            fontSize: 15,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.74)',
            position: 'relative',
            zIndex: 1,
          }}>
            Välj det område som känns mest relevant och svara på frågorna. Vi återkommer med ett skräddarsytt förslag.
          </p>
        </div>
      </header>

      <div style={{ padding: '28px 34px 0', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
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
                  padding: '7px 15px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      <main style={{ padding: '24px 34px 56px', maxWidth: 920 }}>
        <section style={{ marginBottom: 26, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {activeCategory.label}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.65 }}>
            {activeCategory.desc}
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeCategory.questions.map((question, questionIndex) => {
            const value = answers[activeCategory.id]?.[questionIndex]
            return (
              <article
                key={`${activeCategory.id}-${questionIndex}`}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '20px 22px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Fråga {questionIndex + 1}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, color: 'var(--text)', marginBottom: 16 }}>
                  {question.text}
                </div>

                {question.type === 'scale' && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map(option => {
                        const selected = value === `${option}`
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setScale(activeCategory.id, questionIndex, `${option}`)}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: 'var(--text-3)' }}>
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
                      minHeight: 96,
                      resize: 'vertical',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      padding: '12px 14px',
                      fontSize: 14,
                      lineHeight: 1.6,
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                    }}
                  />
                )}

                {question.type === 'choice' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                            padding: '8px 14px',
                            fontSize: 13,
                            lineHeight: 1.45,
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

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
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
            }}
          >
            Skicka svar till Doings →
          </button>
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
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${activeProgress.percent}%`, height: '100%', borderRadius: 999, background: 'var(--accent)', transition: 'width 0.25s ease' }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
            {activeProgress.count} av {activeCategory.questions.length} besvarade
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
      </main>
    </div>
  )
}
