import { chromium } from 'playwright'

const BASE_URL = process.env.DOINGS_BRIEF_BASE_URL || 'http://localhost:3019'
const LOGIN_EMAIL = process.env.DOINGS_BRIEF_TEST_EMAIL
const LOGIN_PASSWORD = process.env.DOINGS_BRIEF_TEST_PASSWORD

const STARTERS = [
  'Reflektion efter dagen',
  'Värde och nästa steg',
  'Dagens upplägg',
]

async function main() {
  requireEnv('DOINGS_BRIEF_TEST_EMAIL', LOGIN_EMAIL)
  requireEnv('DOINGS_BRIEF_TEST_PASSWORD', LOGIN_PASSWORD)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()

  try {
    await login(page)
    await openEvaluationWorkspace(page)
    await openAllStarterBlocks(page)
    await verifySingleBlockSelection(page)
    await verifyMixedQuestionSelection(page)
    await verifyPreviewStability(page)

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      verified: [
        'all starter blocks open independently',
        'whole-block selection stays scoped to clicked block',
        'individual question selection updates counts and preview',
        'preview step buttons render after mixed selection',
      ],
    }, null, 2))
  } finally {
    await context.close()
    await browser.close()
  }
}

async function login(page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill(LOGIN_EMAIL)
  await page.locator('input[type="password"]').fill(LOGIN_PASSWORD)
  await Promise.all([
    page.waitForURL('**/dashboard/evaluations/new**', { timeout: 20000 }),
    page.getByRole('button', { name: /logga in/i }).click(),
  ])
}

async function openEvaluationWorkspace(page) {
  await page.goto('/dashboard/evaluations/new', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /skapa utvärdering/i }).waitFor({ timeout: 15000 })
  await page.getByText('Välj ett upplägg för dagens utvärdering', { exact: false }).waitFor({ timeout: 15000 })
}

async function openAllStarterBlocks(page) {
  for (const starter of STARTERS) {
    const card = starterCard(page, starter)
    await card.getByRole('button', { name: /öppna frågor/i }).click()
  }

  await starterCard(page, 'Reflektion efter dagen').getByText('Vad tar du framför allt med dig från dagen?', { exact: false }).waitFor({ timeout: 15000 })
  await starterCard(page, 'Värde och nästa steg').getByText('Vad var mest värdefullt för dig under workshopen?', { exact: false }).waitFor({ timeout: 15000 })
  await starterCard(page, 'Dagens upplägg').getByText('Hur upplevde du dagens upplägg och tempo?', { exact: false }).waitFor({ timeout: 15000 })
}

async function verifySingleBlockSelection(page) {
  const valueCard = starterCard(page, 'Värde och nästa steg')

  await valueCard.getByRole('button', { name: /välj hela blocket/i }).click()
  await expectText(valueCard, '3 av 3 valda')
  await expectText(starterCard(page, 'Reflektion efter dagen'), 'Inga valda')
  await expectText(starterCard(page, 'Dagens upplägg'), 'Inga valda')
}

async function verifyMixedQuestionSelection(page) {
  const reflectionCard = starterCard(page, 'Reflektion efter dagen')
  const facilitationCard = starterCard(page, 'Dagens upplägg')

  await reflectionCard.getByLabel('Vad tar du framför allt med dig från dagen?').check()
  await facilitationCard.getByLabel('Hur upplevde du dagens upplägg och tempo?').check()

  await expectText(reflectionCard, '1 av 3 valda')
  await expectText(facilitationCard, '1 av 3 valda')

  const statsArea = page.locator('main')
  await statsArea.getByText(/^5$/, { exact: true }).waitFor({ timeout: 15000 })
}

async function verifyPreviewStability(page) {
  const preview = page.locator('main').getByText(/Fråga 1 av 5|Fråga 1 av 4|Fråga 1 av 6/, { exact: false }).first()
  await preview.waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Fråga 5' }).waitFor({ timeout: 15000 })
}

function starterCard(page, title) {
  return page.getByText(title, { exact: true }).locator('xpath=ancestor::div[contains(@style, "border-radius: 12px")]').first()
}

async function expectText(locator, text) {
  await locator.getByText(text, { exact: false }).waitFor({ timeout: 15000 })
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
