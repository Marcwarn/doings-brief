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
- `/dashboard/send` har nu ett lugnare formulärspråk med mjukare kort, neutralare CTA:er och samma visuella riktning som den uppdaterade loginvyn
- Brief-subnaven är nu förenklad till `Nytt utskick`, `Översikt` och `Frågebatterier`, medan kunder och utskick fångas upp under översikten

**Saknas**: `app/dashboard/error.tsx` (ingen error boundary — okänt React-fel kraschar hela sidan)

---

## `/dashboard/discovery` — Discoveryyta

- Egen meny i dashboarden
- Speglar discovery-landningssidan visuellt med nuvarande `doings-brief`-färger och typografi
- Teman och frågor ligger exakt enligt discovery-referensen
- Split-view med redigering till vänster och kundförhandsvisning till höger
- Redigeringspanelen är nu uppdelad i flikarna `Frågor`, `Upplägg` och `Skicka`, med aktiva teman kvar överst
- Tabs mellan teman, progress per tema, skalknappar, öppna svar och valbara alternativ
- Buildern kan nu öppna tidigare Discovery-upplägg i en tydligare lista med kund, målgrupp och senaste aktivitet
- Buildern kan nu slå av hela teman för att smalna av ett bredare Discovery innan det sparas eller skickas
- Discovery har nu dokumenterad spec, ADR och initial SQL-schema-grund i repo:t
- `/api/discovery/templates` kan nu spara och lista Discovery-upplägg för inloggad konsult
- `/api/discovery/templates/[id]` kan nu hämta ett fullständigt sparat Discovery-upplägg
- Buildern i `/dashboard/discovery` kan nu spara nya upplägg och ladda sparade upplägg från databasen
- Discovery-upplägg har nu `audience_mode` på template-nivå: `shared`, `leaders`, `mixed`
- Buildern kan nu ladda rekommenderade standardfrågor utifrån vald målgrupp, främst för Ledarskap, Change management, AI readiness och Vision & mål
- Publik route `/discovery/[token]` och token-API finns nu för att visa och skicka in Discovery-svar
- `/api/discovery/send` kan nu skapa sessions och skicka Discovery-mejl, och buildern kan trigga utskicket
- `/api/discovery/submit` skickar nu notismail till konsulten när ett Discovery-svar kommer in
- `/dashboard/discovery/responses` och `/api/discovery/sessions*` finns nu för att följa Discovery-sessions och öppna enskilda svar
- `/api/discovery/remind` och knappar i responses-vyn kan nu skicka manuella påminnelser till väntande Discovery-mottagare
- `Discovery` har nu dokumenterad riktlinje för målgruppsanpassning: vissa teman ska vara gemensamma, medan andra senare bör få varianter för ledare kontra blandade grupper

**Saknas**: Eventuell mer avancerad översikt/filtering och dispatch-gruppering för Discovery

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
- Loginvyn är nu nedtonad visuellt med ljusare shell, mörk primärknapp och mindre skrikig accentanvändning

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
