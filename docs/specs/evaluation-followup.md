# Evaluation Follow-Up

## Syfte

`Utvärdering` ska inte bara samla in feedback efter en fysisk utbildning. Den ska också vara startpunkten för enkel, kundbunden uppföljning för icke-tekniska konsulter.

Flödet ska vara:

1. Konsulten håller en fysisk utbildning
2. Deltagarna svarar via QR-kod
3. E-post samlas in i utvärderingen
4. Deltagarna kopplas automatiskt till rätt kundflöde i sender.net
5. Konsulten sätter upp 1-3 enkla uppföljningssteg i Doings Brief
6. Systemet visar tydligt vad som är planerat, skickat och till vilka

Konsulten ska inte behöva arbeta direkt i sender.net för att förstå eller styra uppföljningen.

---

## Produktprincip

För användarna ska detta upplevas som:

- `Utvärdering` samlar in deltagare
- `Uppföljning` styr vad som händer efter utbildningen
- sender.net är bara motorn i bakgrunden

Undvik att bygga ett tekniskt marketing automation-gränssnitt i Doings Brief. Konsulten ska tänka i:

- kund
- tillfälle
- deltagare
- uppföljningssteg

Inte i:

- segment
- automations
- kampanjobjekt
- subscribers API

---

## Nuvarande läge

Det som redan finns:

- QR-kod + publik deltagarlänk för utvärdering
- insamling av e-post i utvärderingen
- sender.net-integration i `lib/sender.ts`
- `senderGroupId` sparas på utvärderingens metadata
- deltagare läggs automatiskt till sender.net när de skickar in svar
- detaljvyn visar en `Uppföljning`-flik med status

Begränsningar i nuvarande implementation:

- gruppkopplingen är i praktiken bara en enkel sender-grupp på utvärderingen
- nuvarande gruppnamngivning är inte tydligt modellerad för `kund + tillfälle`
- ingen separat global grupp för alla utbildningsdeltagare
- ingen riktig tidslinje för uppföljningssteg
- ingen logg per steg över vilka utskick som gått till vilka
- ingen enkel konsult-UI för att välja mall och fördröjning

---

## Målbild

Varje utvärdering ska kunna bära två parallella gruppkopplingar:

1. `Kund/tillfälle-grupp`
- exakt de deltagare som gick just den utbildningen
- används för kundspecifik uppföljning i flera steg

2. `Global utbildningsgrupp`
- alla deltagare från alla utbildningar
- används för bredare generella utskick och nyhetsbrev

Varje utvärdering ska dessutom kunna ha en enkel uppföljningsplan:

- steg 1 efter 7 dagar
- steg 2 efter 30 dagar
- steg 3 efter 90 dagar

Varje steg ska kunna kopplas till en sender-mall och visas med tydlig status i Doings Brief.

---

## Datamodell

## Evaluation metadata

Utöka `EvaluationMetadata` i `lib/evaluations.ts` med:

- `senderCustomerGroupId: string | null`
- `senderCustomerGroupName: string | null`
- `senderGlobalGroupId: string | null`
- `senderGlobalGroupName: string | null`

Behåll bakåtkompatibilitet med nuvarande `senderGroupId` under migreringsperioden om befintliga utvärderingar redan använder det.

## Ny tabell: `evaluation_followup_steps`

Syfte:
- beskriver vilka uppföljningssteg som hör till en utvärdering

Fält:

- `id uuid primary key`
- `evaluation_id text not null`
- `step_order int not null`
- `delay_days int not null`
- `sender_template_id text null`
- `sender_template_name text null`
- `active boolean not null default true`
- `scheduled_for timestamptz null`
- `sent_at timestamptz null`
- `status text not null default 'draft'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Statusvärden i v1:

- `draft`
- `scheduled`
- `sent`
- `failed`

## Ny tabell: `evaluation_followup_deliveries`

Syfte:
- loggar vilka mottagare som fick vilket uppföljningssteg

Fält:

- `id uuid primary key`
- `step_id uuid not null`
- `evaluation_id text not null`
- `email text not null`
- `status text not null default 'pending'`
- `sent_at timestamptz null`
- `sender_message_id text null`
- `created_at timestamptz not null default now()`

Statusvärden i v1:

- `pending`
- `sent`
- `failed`

---

## sender.net-modell

## Gruppnivåer

När en utvärdering skapas ska systemet försöka säkra två grupper:

1. Kund/tillfälle-grupp
- namnförslag: `{kund} — {tillfälle}`
- används för just den utbildningens uppföljning

2. Global utbildningsgrupp
- namnförslag: `Doings utbildningsdeltagare`
- används för bredare framtida utskick

## När någon svarar

Om utvärderingen samlar in e-post:

- lägg deltagaren i kund/tillfälle-gruppen
- lägg deltagaren i globalgruppen

Detta ska vara fire-and-forget och aldrig blockera själva inlämningen.

## Viktig princip

Doings Brief ska inte försöka spegla hela sender.net. Systemet behöver bara stödja:

- säkra att rätt grupper finns
- lägga till deltagare i rätt grupper
- välja mall per uppföljningssteg
- logga att steg skickades

---

## API-förslag

## Uppdatera befintliga routes

### `POST /api/evaluations/create`

Nuvarande route ska utökas så att den:

- skapar eller återanvänder kund/tillfälle-grupp
- skapar eller återanvänder global grupp
- sparar båda group ids + namn i evaluation metadata

### `POST /api/evaluations/public/[token]/submit`

Nuvarande route ska utökas så att den:

- fortsatt sparar svar som idag
- lägger till deltagaren i kund/tillfälle-gruppen
- lägger till deltagaren i globalgruppen

## Nya routes

### `GET/POST /api/evaluations/[id]/followup`

Ansvar:

- hämta alla uppföljningssteg för en utvärdering
- skapa nya steg
- uppdatera befintliga steg i bulk eller ett i taget

### `POST /api/evaluations/[id]/followup/send`

Ansvar:

- skicka ett specifikt steg manuellt
- eller köra alla förfallna steg för utvärderingen
- logga leveranser per mottagare i `evaluation_followup_deliveries`

### Eventuell route: `GET /api/sender/templates`

Behövs om sender.net har ett API för att lista mallar.

Om det inte går i v1:

- spara manuellt `sender_template_id`
- visa ett fritt namn- eller etikettfält i UI:t

---

## UI-förslag

Primär arbetsyta:

- `app/dashboard/evaluations/[id]/page.tsx`

Behåll fliken `Uppföljning`, men gör den till en enkel uppföljningsyta.

## Vad konsulten ska se

1. Gruppstatus

- kund/tillfälle-grupp aktiv
- global grupp aktiv
- antal deltagare med e-post

2. Uppföljningssteg

Per steg:

- `Skicka efter`: exempelvis `7 dagar`
- `Mall`: vald sender-mall
- `Aktiv`: ja/nej
- `Status`: utkast, planerad, skickad, misslyckad

3. Enkel logg

- vilka steg som gått
- när de gick
- hur många mottagare som fick dem
- möjlighet att klicka in till enkel mottagarlista vid behov

## Vad konsulten inte ska behöva se

- sender API-fel i tekniskt språk
- interna sender-objekt
- avancerade marketing automation-begrepp

Fel och tomlägen ska översättas till:

- `Uppföljning är inte aktiv ännu`
- `Ingen mall vald`
- `Ingen kundgrupp kunde kopplas`
- `Det här steget har inte skickats ännu`

---

## Rekommenderad v1

Bygg först en halvautomatisk version.

Det innebär:

- konsulten skapar 1-3 steg i Doings Brief
- varje steg får antal dagar + mall
- systemet räknar fram när steget ska gå
- konsulten kan trycka `Skicka nu`
- systemet loggar exakt vilka mottagare som fick steget

Detta räcker långt och minskar risk jämfört med att börja med full automation direkt.

---

## Rekommenderad v2

När v1 fungerar stabilt:

- kör förfallna steg automatiskt via cron eller Vercel Cron
- uppdatera status automatiskt
- visa tydligare historik för skickade steg

Först då bör full automation aktiveras.

---

## Byggordning

1. Lägg till migration för `evaluation_followup_steps` och `evaluation_followup_deliveries`
2. Utöka `EvaluationMetadata` i `lib/evaluations.ts`
3. Bygg ut `lib/sender.ts` för två gruppnivåer
4. Uppdatera `POST /api/evaluations/create`
5. Uppdatera `POST /api/evaluations/public/[token]/submit`
6. Lägg till `GET/POST /api/evaluations/[id]/followup`
7. Lägg till `POST /api/evaluations/[id]/followup/send`
8. Bygg enkel `Uppföljning`-UI i utvärderingsdetaljen
9. Lägg till enkel leveranslogg
10. Lägg till schemalagd körning först när v1 används och förstås av konsulterna

---

## Beslut

`Loopar` ska inte vara navet för detta flöde i första hand.

För användarnas skull ska uppföljning efter utbildning bo under `Utvärdering`, eftersom det är där:

- deltagarna samlas in
- kundkopplingen redan finns
- konsulten naturligt förväntar sig att fortsättningen ska ligga

`Loopar` kan återanvändas tekniskt senare om det hjälper implementationen, men ska inte styra produktens informationsarkitektur för v1.
