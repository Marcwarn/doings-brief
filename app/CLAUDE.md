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
- Klientens briefyta har nu ett lugnare premiumskal med mörk topp, ljus huvudyta och tydligare rytm genom intro, fråga och review
- Brief-inbjudan via mejl har nu samma lugnare visuella riktning och mer personlig copy

**Saknas**: Autosave/draft (stänger webbläsaren = förlorar alla svar)

---

## `/dashboard` — Konsultvy (kräver Supabase-session)

- Översikt: pending/submitted per kund och dispatch
- "Needs attention"-panel med aktiva dispatches
- Manuell påminnelseknapp för väntande dispatches
- Länk till sessionsdetalj, frågeuppsättningar, kunder, utskicksflöde
- AI-sammanfattning per session (genereras via `/api/briefs/summarize`)
- Word-export av brief + sammanfattning
- `/dashboard/send` är nu en lätt split-workspace med vänster redigering och höger mottagarpreview
- `Brief`-workspace är nu uppdelad i `Frågor`, `Upplägg` och `Skicka`
- högerpanelen i `Brief` förhandsvisar nu intro, rytm, progress och första frågan så som mottagaren möter briefen
- `/dashboard` och `/dashboard/question-sets` har nu samma lugnare workspace-UI som `Nytt utskick`, med mjukare paneler, tydligare hierarki och mindre adminkänsla
- mottagarimport i `/dashboard/send` är nu begränsad till `.csv` och `.txt` för att undvika osäkert Excel-beroende
- Brief-subnaven är nu förenklad till `Nytt utskick`, `Översikt` och `Frågebatterier`, medan kunder och utskick fångas upp under översikten
- Den synliga produktetiketten i dashboarden är nu `Debrief`, och sidomenyns huvudlänk går direkt till `Nytt utskick` i stället för översikten

**Saknas**: `app/dashboard/error.tsx` (ingen error boundary — okänt React-fel kraschar hela sidan)

---

## `/dashboard/discovery` — Discoveryyta

- Egen meny i dashboarden
- Speglar discovery-landningssidan visuellt med nuvarande `doings-brief`-färger och typografi
- Teman och frågor ligger exakt enligt discovery-referensen
- Split-view med redigering till vänster och kundförhandsvisning till höger
- Redigeringspanelen är nu uppdelad i flikarna `Frågor`, `Upplägg`, `Skicka` och `Data`, med aktiva teman kvar överst
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
- `Discovery` kan nu också skickas i anonymt läge via en delbar länk i stället för personliga mottagare
- anonymt läge i `Skicka` har nu tydligare delnings-UI med instruktioner och kopiera-länk-knapp
- den publika `Discovery`-sidan stödjer nu frivilliga bakgrundsfält för roll och team/enhet i anonymt läge
- `/api/discovery/submit` skickar nu notismail till konsulten när ett Discovery-svar kommer in
- Discovery-svar sparas nu via en separat submissionsnivå under sessionen, så att flera anonyma svar kan komma in bakom samma länk
- `/dashboard/discovery/responses` och `/api/discovery/sessions*` finns nu för att följa Discovery-sessions och öppna enskilda svar
- `/api/discovery/remind` och knappar i responses-vyn kan nu skicka manuella påminnelser till väntande Discovery-mottagare
- `Discovery` har nu dokumenterad riktlinje för målgruppsanpassning: vissa teman ska vara gemensamma, medan andra senare bör få varianter för ledare kontra blandade grupper
- `Discovery` har nu en dokumenterad spec för en framtida `Data`-flik med visualiseringar, råsvar och fasta AI-analyslinser
- `Discovery` har nu en separat AI-spec för `Data` som definierar analyslinser, JSON-output, promptregler och hur observation ska skiljas från tolkning
- `Data`-fliken visar nu en första riktig datavy med filter, översiktskort, temakort och råsvar för det sparade discovery-upplägget
- `/api/discovery/data/[id]` aggregerar sessions, sektionstäckning och råsvar för datavyn
- `Data` och AI-analysen i Discovery tar nu hänsyn till anonymt läge och grupperar fortsatt kund först
- `Data`-fliken kan nu generera AI-analys från fasta analyslinser direkt i discoveryytan
- `/api/discovery/analyze` hämtar eller genererar strukturerad AI-analys för valt Discovery-urval och cachar resultatet i `settings`
- `Discovery`-analysen har nu hårdare sanningsspärrar: tunt underlag ger bara en preliminär läsning, och observationer måste bära konkret underlag från aktuella svar
- `Discovery` visar nu också AI-status i `Data`, så det blir tydligt om nuvarande eller framtida analysprovider faktiskt är konfigurerad i Vercel
- `Discovery Data` använder nu Anthropic som aktiv analysprovider när `ANTHROPIC_API_KEY` finns i miljön
- `Data`-fliken visar nu ett tomt första läge när inga svar finns ännu, i stället för en färdig datavy
- när svar finns är `Data` nu kundcentrerad i UI:t: man väljer kundspår först och låter sedan teman, råsvar och AI-analys följa samma scope
- `Data` har nu också en starkare visuell kundöverblick med rikare kundkort, tydligare vald-kund-sammanhang och mer redaktionella temakort

**Saknas**: Eventuell mer avancerad översikt/filtering och dispatch-gruppering för Discovery

---

## `/evaluation` — Utvärderingsformulär (publik)

Separat flöde från brief — används för att samla in feedback från klienter.

- Den publika utvärderingssidan har nu ett lugnare skal med mörk topp, ljus huvudyta och tydligare "tack för idag"-ton för workshopdeltagare
- Dashboardytorna för utvärdering har nu också fått ett lugnare workspace-UI med mjukare kort, tydligare länk/QR-sektioner och mindre tabellkänsla i översikten
- Utvärdering utgår nu tydligare från egna workshopfrågor och starter-upplägg, medan återanvändning av tidigare frågor bara är en sekundär startpunkt

---

## `/admin` — Adminpanel (kräver `role: admin`)

- Bulk-template hantering
- Konsultinbjudningar
- Användarhantering
- bulk-import i admin är nu begränsad till `.csv` och `.txt`

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
