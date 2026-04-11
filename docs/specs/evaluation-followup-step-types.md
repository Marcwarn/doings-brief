# Evaluation Follow-Up Step Types

## Syfte

`Uppföljning` ska inte bara bestå av tidsfördröjda mejl. Varje steg behöver en tydlig produktlogik som förklarar:

- vad konsulten ställer in
- vad deltagaren får
- vad systemet gör i bakgrunden
- vad som loggas tillbaka till konsulten

Den här specen beskriver hur uppföljningssteg ska fungera som produkt, inte bara som UI-element.

---

## Grundmodell

Varje uppföljningssteg ska ha:

- en `typ`
- en `fördröjning`
- en `mall`
- en `målhandling`
- en `status`

Det viktiga är att konsulten inte ska behöva förstå teknik eller automation. Konsulten ska bara välja:

- vad steget är till för
- när det ska gå ut
- vilket innehåll det ska bära

---

## Stegtyp 1: `Meddelande`

## Syfte

Ett rent uppföljningsmejl som inte kräver någon ytterligare handling av deltagaren.

Används när konsulten vill:

- påminna
- förstärka ett budskap
- följa upp med reflektion eller sammanfattning
- hålla relationen levande utan att skapa ett nytt moment

## Vad konsulten ställer in

- `Skickas efter`
- `Mall`

Inget mer ska behövas i v1.

## Vad deltagaren upplever

- ett tydligt mejl
- relevant ämnesrad
- lugn och begriplig copy
- CTA är valfri

CTA kan i många fall vara frånvarande eller mycket lågmäld.

## Systemlogik

- steget skickas till alla relevanta mottagare i tillfällesgruppen
- mottagare loggas i `evaluation_followup_deliveries`
- status uppdateras till `sent` eller `failed`

## Vad konsulten ser i loggen

- skickat datum
- antal mottagare
- vilka mottagare som fick mejlet
- leveransstatus

---

## Stegtyp 2: `Meddelande med länk`

## Syfte

Ett uppföljningsmejl som leder deltagaren vidare till något konkret.

Exempel:

- resurssida
- kundanpassat material
- bokningssida
- sammanfattning
- nästa steg i utbildningen

## Vad konsulten ställer in

- `Skickas efter`
- `Mall`
- `Länkmål`

Länkmålet ska beskrivas enkelt i UI:t.

Undvik tekniska ord som `target URL`. Använd i stället något i stil med:

- `Knappen leder till`

## Vad deltagaren upplever

- ett mejl
- en tydlig CTA
- ett begripligt nästa steg

Det ska kännas som en naturlig förlängning av utbildningen, inte som reklam eller ett systemmeddelande.

## Systemlogik

- steget skickas till relevanta mottagare
- länken i mallen sätts till valt mål
- leverans loggas
- om möjligt bör klick kunna mätas senare, men det är inte krav i v1

## Vad konsulten ser i loggen

- vilka som fick mejlet
- skickat datum
- eventuellt senare klickstatus om det stöds

---

## Stegtyp 3: `Meddelande med frågor`

## Syfte

Ett uppföljningsmejl som leder vidare till ett kort frågeflöde efter utbildningen.

Detta är en viktig framtida funktion.

Exempel på användning:

- 1 vecka senare: hur har det landat?
- 1 månad senare: vad har du testat?
- 3 månader senare: vad har faktiskt förändrats?

## Viktig princip

Den här stegtypen får inte reduceras till copy i en preview. Om den finns i produkten ska den ha ett riktigt frågeflöde bakom sig.

## Vad konsulten ställer in

- `Skickas efter`
- `Mall`
- `Frågeuppsättning` eller `uppföljningsfrågor`

Det bör senare gå att:

- välja en liten färdig uppföljningsmall
- eller skapa 1-3 enkla egna frågor

## Vad deltagaren upplever

- ett mejl som känns personligt och relevant
- en CTA som leder till ett lättviktsformulär
- ett mycket kort flöde

Detta formulär ska vara:

- snabbt
- tydligt
- mobilvänligt
- friktionsfritt

## Systemlogik

- mejlet skickas som vanligt via sender
- CTA leder till en Doings-sida eller ett Doings-formulär
- deltagarens svar lagras som uppföljningssvar för just det steget
- konsulten kan se dessa svar i utvärderingens uppföljningsyta

## Vad konsulten ser i loggen

- vilka som fick steget
- vilka som öppnade uppföljningen
- vilka som svarade
- inkomna svar kopplade till steget

---

## Rekommenderad ordning för implementation

1. `Meddelande`
2. `Meddelande med länk`
3. `Meddelande med frågor`

Detta är den säkraste ordningen eftersom:

- första steget kräver minst ny backendlogik
- andra steget bygger vidare med enkel CTA-styrning
- tredje steget kräver ett nytt mottagarflöde och egen datamodell

---

## UI-konsekvenser

När konsulten väljer stegtyp ska UI:t förändras så lite som möjligt.

Målet är att samma stegkort ska kännas bekant oavsett typ.

## Gemensamt för alla steg

Visa alltid:

- `Typ`
- `Skickas efter`
- `Mall`
- `Aktiv`

## Visa bara när det behövs

För `Meddelande med länk`:

- visa `Knappen leder till`

För `Meddelande med frågor`:

- visa `Frågor i uppföljningen`

Detta ska vara progressivt och lågfriktionsbaserat.

---

## Preview-regler

Previewn till höger ska alltid visa mottagarens upplevelse.

Det betyder:

- aldrig interna systemord
- aldrig tekniska metadata
- aldrig setup-detaljer

## `Meddelande`

Preview visar:

- mejlet
- eventuell CTA om mallen har en sådan

## `Meddelande med länk`

Preview visar:

- mejlet
- CTA med känsla av att leda vidare

## `Meddelande med frågor`

Preview visar:

- mejlet
- CTA som antyder uppföljning

Men:

- previewn får inte påstå att frågeflödet redan finns, om det ännu inte är byggt
- när funktionen byggs klart ska previewn kunna visa en trovärdig fortsättning

---

## Logg och uppföljning

Oavsett stegtyp ska konsulten senare kunna se:

- vad som skickats
- när det skickades
- till vilka

Utöver detta:

`Meddelande`
- endast leveranshistorik

`Meddelande med länk`
- leveranshistorik
- senare eventuellt klick

`Meddelande med frågor`
- leveranshistorik
- öppningar mot frågeflödet
- inkomna svar

---

## Produktprincip

För konsulten ska skillnaden mellan stegtyper kännas semantisk, inte teknisk.

Konsulten ska tänka:

- vill jag bara skicka något?
- vill jag leda vidare?
- vill jag ställa några nya frågor?

Detta är rätt nivå av produktlogik för ett enkelt men smart system.
