# Evaluation Follow-Up UX

## Syfte

`Uppföljning` ska vara en naturlig del av `Utvärdering`, inte ett separat tekniskt system.

Målet är att icke-tekniska konsulter ska kunna:

- samla in deltagare via QR-kod
- förstå att e-postadresserna går in i uppföljningen
- lägga upp 1-3 enkla uppföljningssteg
- välja rätt mall för varje steg
- se vad som har skickats och till vilka

Detta ska ske utan att användaren behöver tänka i sender.net-begrepp eller marketing automation-logik.

---

## Grundprincip

`Utvärdering` är huvudobjektet.

`Uppföljning` är en del av samma arbetsflöde.

Det ska inte finnas en separat informationsarkitektur där användaren måste hoppa till ett annat system eller ett annat mentalt läge.

Produkten ska kännas:

- lugn
- reducerad
- självinstruerande
- konsekvent

Referensen är en Apple-lik enkelhet:

- en tydlig arbetsyta
- få beslut i taget
- ingen redundant design
- ingen teknisk överförklaring

---

## Placering i UI

`Uppföljning` ska ligga i samma horisontella arbetsrad som:

- `Frågor`
- `Upplägg`
- `Publicera`
- `Uppföljning`

Detta ska ske i samma skapa-/redigeravy för utvärderingen.

Användaren ska uppleva:

1. jag bygger utvärderingen
2. jag publicerar den
3. jag ställer in uppföljningen

Ingen ny sektion i sidomenyn ska behövas för detta.

---

## Layout

Samma split-workspace som resten av utvärderingsflödet:

- vänster sida = styrning och inställningar
- höger sida = preview och konsekvens

Princip:

- vänster: det användaren bestämmer
- höger: det mottagaren kommer att se eller det systemet kommer att göra

---

## Vänster sida

Vänstersidan i `Uppföljning` ska innehålla tre block i denna ordning.

## 1. Mottagare

Detta block ska skapa trygghet och förklara logiken.

Det ska visa:

- att deltagare som svarar med e-post inkluderas i uppföljning
- antal deltagare med e-post
- kund
- utbildning
- tillfälle

Det ska inte kännas tekniskt.

Exempel på ton:

- `Deltagare som svarar med e-post kan få uppföljning efter utbildningen`
- `43 deltagare med e-post`

## 2. Steg

Detta är huvudytan.

Varje steg visas som ett lugnt kort eller en enkel rad med:

- `Steg 1`
- `Skickas efter`
- val för fördröjning:
  - `7 dagar`
  - `30 dagar`
  - `90 dagar`
  - eventuellt `Anpassat`
- `Mall`
- val av mall från sender.net

Under varje steg:

- enkel status:
  - `Ingen mall vald`
  - `Mall vald`
  - `Planerat`
  - `Skickat`

Under listan:

- `Lägg till steg`

V1 bör begränsas till max tre steg.

Det gör systemet lätt att förstå och svårt att överkonfigurera.

## 3. Överblick

Detta block sammanfattar vad uppföljningen gör.

Före utskick:

- antal steg
- första steg efter X dagar
- att mottagare samlas in automatiskt via utvärderingen

Efter att systemet börjat användas:

- `Steg 1 skickat`
- `Steg 2 planerat`
- `Senaste utskick`
- `Antal mottagare`

Detta block ska ge lugn, inte detaljerad analys.

---

## Höger sida

Högersidan ska alltid visa preview för det aktiva steget.

Den ska aldrig vara editor.

Mallen ägs i sender.net. Doings Brief väljer och förhandsvisar.

## Tomläge

Om ingen mall är vald:

- rubrik: `Förhandsvisning`
- text: `Välj en mall för att se hur uppföljningen ser ut`

Det ska vara ett lugnt tomläge, inte ett fel.

## När mall är vald

Visa:

- ämnesrad
- avsändare
- renderad preview av mejlet
- gärna tydlig men diskret ram runt previewn

Diskret länk:

- `Öppna i sender`
- eller `Redigera mall i sender`

Poängen är:

- Doings Brief styr flödet
- sender.net äger innehållet

---

## Mallar

Mallarna ska hämtas från sender.net.

Doings Brief ska inte skapa en separat mallvärld i v1.

Skäl:

- samma mall som väljs är samma mall som faktiskt skickas
- ingen dubbel källa för innehåll
- lägre risk för mismatch mellan preview och verkligt utskick
- mindre underhåll

Redigering av mall:

- sker i sender.net
- öppnas via länk från Doings Brief

Doings Brief behöver i v1 bara:

- lista mallar
- låta användaren välja mall
- visa preview

---

## Interaktion

När användaren markerar ett steg:

- höger sida byter preview till det steget

När användaren väljer en mall:

- preview uppdateras direkt

När användaren lägger till ett nytt steg:

- fokus flyttas till det nya steget
- preview visar tomläge eller vald mall för just det steget

När användaren återvänder efter publicering:

- samma yta ska nu visa status och historik

---

## Ordval

Undvik:

- trigger
- automation
- campaign
- subscriber
- segment
- template id

Använd:

- `Uppföljning`
- `Steg`
- `Skickas efter`
- `Mall`
- `Förhandsvisning`
- `Planerat`
- `Skickat`
- `Mottagare`

Om något saknas:

- `Ingen mall vald`
- `Ingen uppföljning inställd ännu`
- `Deltagare med e-post läggs till automatiskt`

---

## Före och efter publicering

Det är samma yta, men med olika tonvikt.

## Före publicering

Fokus:

- ställa in steg
- välja mallar
- förstå vad som kommer att hända

## Efter publicering / efter utbildning

Fokus:

- hur många svar med e-post som kommit in
- vad som är planerat
- vad som har skickats
- till vilka

Det ska kännas som samma verktyg, inte som två olika system.

---

## Informationshierarki

Den viktigaste ordningen för användaren är:

1. detta är min utvärdering
2. detta är min uppföljning
3. detta är vad deltagarna kommer att få
4. detta är vad som redan har skickats

Inte:

1. detta är en sender-integration
2. detta är flera gruppnivåer
3. detta är mallteknik

Den tekniska logiken får finnas i backend, men UI:t ska vara produktlogiskt.

---

## Rekommenderad v1

V1 ska hålla sig till:

- max tre steg
- mallval från sender.net
- preview till höger
- enkel statusöverblick
- enkel historik

Inte i v1:

- avancerad branching
- flera parallella flöden per utvärdering
- komplex filtrering
- mallredigering inne i Doings Brief

---

## Designprincip

UI:t ska kännas som en förlängning av resten av utvärderingsflödet:

- samma visuella språk
- samma split-layout
- samma lugna paneler
- samma reducerade ton

`Uppföljning` ska inte se ut som en ny modul som någon senare har klistrat på produkten.
