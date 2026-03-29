# App — Feature Inventory

**Läs denna fil innan du föreslår något att bygga eller ändra. Verifiera alltid vad som redan finns innan du antar att något saknas.**

---

## `/brief/[token]` — Klientvy (publik, ingen inloggning)

Helt byggd och polerad. Rör inte utan tydlig anledning.

- Röstinspelning via MediaRecorder API med realtidstransskription (Berget/KB-Whisper)
- Visuell waveform + timer under inspelning
- Text-fallback om transkription misslyckas
- En fråga per vy, progress bar, navigering fram/tillbaka
- Review-screen med all Q&A innan inlämning, redigering möjlig
- Fungerar på mobil
- Vid inlämning: sparar svar i `brief_responses`, markerar session som `submitted`, skickar notismail till konsult

**Saknas**: Autosave/draft (stänger webbläsaren = förlorar alla svar)

---

## `/dashboard` — Konsultvy (kräver Supabase-session)

- Översikt: pending/submitted per kund och dispatch
- "Needs attention"-panel med aktiva dispatches
- Manuell påminnelseknapp för väntande dispatches
- Länk till sessionsdetalj, frågeuppsättningar, kunder, utskicksflöde
- AI-sammanfattning per session (genereras via `/api/briefs/summarize`)
- Word-export av brief + sammanfattning

**Saknas**: `app/dashboard/error.tsx` (ingen error boundary — okänt React-fel kraschar hela sidan)

---

## `/dashboard/discovery` — Discoveryyta

- Egen meny i dashboarden
- Speglar discovery-landningssidan visuellt med nuvarande `doings-brief`-färger och typografi
- Teman och frågor ligger exakt enligt discovery-referensen
- Tabs mellan teman, progress per tema, skalknappar, öppna svar och valbara alternativ

**Saknas**: Persistens, verklig submit-koppling och separat publik kundroute

---

## `/evaluation` — Utvärderingsformulär (publik)

Separat flöde från brief — används för att samla in feedback från klienter.

---

## `/admin` — Adminpanel (kräver `role: admin`)

- Bulk-template hantering
- Konsultinbjudningar
- Användarhantering

---

## `/login` och `/auth` — Autentisering

- Supabase Auth med cookie-session
- Password reset-flöde
- Callback-route för OAuth

---

## API-routes — Vad som finns

| Route | Vad den gör |
|---|---|
| `/api/briefs/submit` | Sparar svar, markerar session submitted, **skickar notismail till konsult** |
| `/api/briefs/send-invite` | Skickar inbjudningsmail med token-länk till klient |
| `/api/briefs/remind` | Skickar manuella påminnelsemail till väntande mottagare i konsultens egna utskick |
| `/api/briefs/summarize` | Genererar AI-sammanfattning via Llama-3.3-70B, cachas i settings |
| `/api/briefs/batches` | Hämtar batch-metadata för dashboard-gruppering |
| `/api/briefs/delete` | Tar bort session |
| `/api/transcribe` | Skickar audio till KB-Whisper, returnerar text |
| `/api/generate-questions` | AI-genererar frågeförslag |
| `/api/send-brief-invite` | Email-invite via Resend (konsult → klient) |
| `/api/verify-pin` | Genererar HMAC-token från PIN-kod |
| `/api/brief-access` | Konsultens access gate |
| `/api/customers` | Kundpost-hantering |
| `/api/evaluations` | Utvärderingsformulär-state |
| `/api/admin/*` | Admin: bulk-template, invite, users |

**Finns inte**: Automatisk påminnelsemailing och token-expiry enforcement

---

## Vad som genuint saknas (prioriterat)

1. **Automatiska påminnelser** — manuell påminnelse finns, men ingen scheduler eller overdue-logik
2. **Token-expiry** — inbjudningslänkar gäller för evigt trots att copy säger 30 dagar
3. **Autosave** — klient förlorar svar om webbläsaren stängs
4. **Error boundary** — `app/dashboard/error.tsx` saknas
