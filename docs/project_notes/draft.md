# Draft / WIP-anteckningar

> Den här filen läses automatiskt vid sessionstart och injiceras som kontext.
> Använd den för att beskriva pågående arbete, halvfärdiga features eller saker som
> ska göras härnäst. Töm den när du committar färdigt arbete.

---

- Branch att fortsätta i: `feature/evaluation-followup-ux`
- Utgå från dessa filer först:
  - `app/CLAUDE.md`
  - `docs/specs/evaluation-followup.md`
  - `docs/specs/evaluation-followup-ux.md`
  - `docs/specs/evaluation-followup-step-types.md`

- Det som redan är byggt i UI:
  - `Uppföljning` finns i `app/dashboard/evaluations/new/page.tsx`
  - samma split-workspace som övriga utvärderingsflödet
  - `Uppföljning` är frivillig och startar i ett tomläge
  - användaren kan välja `Skicka manuellt` eller `Skicka automatiskt`
  - varje steg har `Typ`, `Skickas efter`, `Mall`, `Aktivt steg`
  - högersidan visar bara mottagarpreview, inte intern konsultlogik

- Viktiga produktprinciper:
  - `Utvärdering` är huvudobjektet
  - `Uppföljning` är en del av samma flöde, inte en separat produkt
  - sender.net ska vara motor i bakgrunden, inte huvud-UI
  - deltagaren ska aldrig se intern status, automationslogik eller konsultkontroller
  - stegtyperna som planeras är:
    - `Meddelande`
    - `Meddelande med länk`
    - `Meddelande med frågor`

- Nästa rimliga byggsteg:
  - koppla uppföljningsytan till riktig backendmodell
  - läsa in riktiga mallar från sender.net
  - spara uppföljningssteg på utvärderingen
  - definiera verkligt beteende för `Meddelande med frågor`
