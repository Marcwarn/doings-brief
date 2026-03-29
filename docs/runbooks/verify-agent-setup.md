# Engångstest — verifiera att grunden håller

Gör detta en gång. Sedan vet du att allt fungerar.

---

## Test 1: SessionStart-hook injicerar kontext

**Vad som testas**: att agenten får `app/CLAUDE.md`-påminnelsen automatiskt vid sessionsstart.

1. Öppna Claude Code i doings-brief-mappen
2. Starta en ny session
3. Skriv: `vad vet du om vad som är byggt i det här projektet?`

**Förväntat**: Claude svarar med information från `app/CLAUDE.md` utan att du behövt be den läsa filen.

**Fel om**: Claude svarar generiskt eller säger att den inte vet.

---

## Test 2: Skills visas i menyn

**Vad som testas**: att `/backend-reviewer`, `/migration-guard`, `/brief-flow-tester` är tillgängliga.

1. I Claude Code, skriv `/`
2. Bläddra i listan som visas

**Förväntat**: du ser `backend-reviewer`, `migration-guard`, `brief-flow-tester` i listan.

**Fel om**: de saknas i listan.

---

## Test 3: Commit-block fungerar

**Vad som testas**: att PreToolUse-hooken blockerar commit när produktionskod ändrats utan docs.

1. Gör en liten ändring i valfri fil i `app/` eller `lib/` (t.ex. lägg till en kommentar)
2. Staga filen: `git add <filen>`
3. Försök committa utan att ändra `app/CLAUDE.md`: `git commit -m "test"`

**Förväntat**: commit blockeras med meddelandet:
> `Produktionskod andrad men dokumentationen inte uppdaterad...`

4. Uppdatera `app/CLAUDE.md` (lägg till ett tecken), staga den också
5. Försök committa igen

**Förväntat**: commit går igenom.

**Fel om**: commit går igenom utan att docs är stagead.

---

## Om något test misslyckas

| Test | Trolig orsak |
|---|---|
| Test 1 | SessionStart-hook triggar inte — kontrollera att `matcher: "startup\|resume"` finns i `.claude/settings.json` |
| Test 2 | Skills saknar frontmatter eller fel filnamn — kontrollera att `SKILL.md` har `---\nname: ...\n---` överst |
| Test 3 | Hook-scriptet har inte körbar rättighet eller `jq` saknas — kör `chmod +x .claude/hooks/check-docs-updated.sh` |

---

När alla tre är godkända: grunden håller. Inga fler tester behövs om inte `settings.json` eller skills ändras.
