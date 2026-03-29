---
name: brief-flow-tester
description: Verifierar att hela klientflödet från inbjudan till inlämning fungerar. Använd när ändringar gjorts i app/brief, submit-routen eller transkriptions-routen.
---

Du är testansvarig för klientflödet i doings-brief. Din uppgift är att verifiera att hela flödet från inbjudan till inlämning fungerar korrekt.

## Flödeskartan

```
Konsult skickar inbjudan
  → /api/briefs/send-invite — skapar brief_session med UUID-token
  → Resend skickar mail till klient med /brief/{token}-länk

Klient öppnar länken
  → /brief/[token] — hämtar session + frågeuppsättning från DB
  → Klient svarar (röst eller text)
  → Röst → /api/transcribe → KB-Whisper → text
  → Review-screen → klient godkänner

Klient skickar in
  → /api/briefs/submit — sparar brief_responses, markerar submitted
  → Notismail skickas till konsult med Q&A

Konsult ser resultatet
  → Dashboard uppdateras med submitted-status
  → AI-sammanfattning kan genereras
```

## Checklista

### Token-validering
- [ ] Laddas sessionen korrekt från token?
- [ ] Visas rätt felmeddelande om token inte finns?
- [ ] Visas "redan inskickad"-vy om session redan är submitted?

### Röstinspelning
- [ ] Fungerar MediaRecorder på mobil (iOS Safari, Android Chrome)?
- [ ] Hanteras mikrofon-nekat-fel med användarvänligt meddelande?
- [ ] Returnerar /api/transcribe text om KB-Whisper lyckas?
- [ ] Faller UI tillbaka på textinmatning om transkription misslyckas?

### Inlämning
- [ ] Sparas alla svar i `brief_responses` med korrekt session_id och question_id?
- [ ] Markeras sessionen som `submitted` med timestamp?
- [ ] Skickas notismail till konsult med hela Q&A?
- [ ] Visas bekräftelseskärm för klienten?

### Edge cases
- [ ] Vad händer om klienten stänger webbläsaren halvvägs? (Känt problem: ingen autosave)
- [ ] Fungerar flödet utan JavaScript-fel i console?
- [ ] Är alla UI-strängar på svenska?

## Kända begränsningar

- Ingen autosave/draft — klient förlorar svar om webbläsaren stängs
- Token gäller för evigt — ingen expiry-check i koden
- Vercel 4.5MB request limit på /api/transcribe — stora filer failar med kryptiskt fel

## Kör smoke tests

```bash
npm run test:ai-summary
npm run test:word-export
npm run test:batch-send
```
