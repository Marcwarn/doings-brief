# 2026-04-03 Debug Notes

Det som kostade onödig tid i denna felsökningsrunda:

- Vi började i en lokal kopia som låg efter GitHub, trots att senaste sanningen fanns på `github.com`.
- Vi verifierade först i en worktree med placeholder-envs, vilket räckte för build och routes men inte för visuell godkänd login-test.
- Friendly URLs lades först bara som rewrites. För App Router behövdes riktiga alias-routes också för att undvika klient-404.
- Den riktiga lokala arbetsmappen låg så långt efter `origin/main` att enstaka filkopiering gav följdfel som saknade moduler. Hela senaste kodbasen behövde därför synkas in innan visuell test.
- Login var fortfarande kopplad till gammal `brief-access`-grind. Det behövde byggas om till ren session/profile-kontroll i stället för att symptomfixas.

Arbetssätt nästa gång för snabbare orkestrering:

- Börja alltid från senaste `origin/main` eller GitHub-HEAD innan felsökning.
- Bekräfta tidigt om användaren behöver visuell verifiering med riktig login/data, inte bara teknisk verifiering.
- Om URL-aliaser införs i App Router: skapa både omskrivning och faktiska route-filer direkt.
- Om lokal arbetsmapp ligger efter: synka hela repo-baslinjen innan punktfixar görs.
- Separera tydligt mellan auth/session, produktbehörighet och adminbehörighet så att loginflödet inte blockeras av gammal affärslogik.
