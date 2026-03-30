import { chromium } from 'playwright'

const BASE_URL = process.env.DOINGS_BRIEF_BASE_URL || 'https://doings-brief.vercel.app'
const LOGIN_EMAIL = process.env.DOINGS_BRIEF_TEST_EMAIL
const LOGIN_PASSWORD = process.env.DOINGS_BRIEF_TEST_PASSWORD
const RESPONSE_URL = process.env.DOINGS_BRIEF_RESPONSE_URL

async function main() {
  requireEnv('DOINGS_BRIEF_TEST_EMAIL', LOGIN_EMAIL)
  requireEnv('DOINGS_BRIEF_TEST_PASSWORD', LOGIN_PASSWORD)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL })
  const page = await context.newPage()

  try {
    await login(page)
    const responsePageUrl = await openResponsePage(page)
    await triggerSummary(page)
    await verifySummaryPanel(page)
    await verifyCopyAction(page)
    await verifyCachedSummary(page)

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      responsePageUrl,
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

async function openResponsePage(page) {
  if (RESPONSE_URL) {
    await page.goto(RESPONSE_URL, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /sammanfatta med ai|generera om ai-sammanfattning/i }).waitFor({ timeout: 15000 })
    return page.url()
  }

  await page.goto('/dashboard/briefs', { waitUntil: 'networkidle' })
  const firstResponseLink = page.getByRole('link', { name: /se svar/i }).first()
  await firstResponseLink.waitFor({ timeout: 15000 })
  await Promise.all([
    page.waitForURL('**/dashboard/briefs/**', { timeout: 15000 }),
    firstResponseLink.click(),
  ])
  await page.getByRole('button', { name: /sammanfatta med ai|generera om ai-sammanfattning/i }).waitFor({ timeout: 15000 })
  return page.url()
}

async function triggerSummary(page) {
  const button = page.getByRole('button', { name: /sammanfatta med ai|generera om ai-sammanfattning/i })
  await button.click()

  await Promise.race([
    page.getByText('AI-sammanfattning', { exact: true }).waitFor({ timeout: 30000 }),
    page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase()
      return (
        text.includes('kunde inte skapa ai-sammanfattningen') ||
        text.includes('nätverksfel') ||
        text.includes('internt serverfel') ||
        text.includes('ogiltigt svar')
      )
    }, { timeout: 30000 }).then(async () => {
      const text = await page.locator('body').textContent()
      throw new Error(text || 'AI summary failed')
    }),
  ])
}

async function verifySummaryPanel(page) {
  const sectionTitles = [
    'Kort sammanfattning',
    'Viktigaste signaler',
    'Risker eller oklarheter',
    'Följdfrågor',
    'Rekommenderade nästa steg',
    'Bygger främst på',
  ]

  for (const title of sectionTitles) {
    await page.getByText(title, { exact: true }).waitFor({ timeout: 15000 })
  }

  const bodyText = await page.locator('body').textContent()
  assertIncludes(bodyText || '', 'AI-sammanfattning', 'summary panel header')
}

async function verifyCachedSummary(page) {
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('AI-sammanfattning', { exact: true }).waitFor({ timeout: 15000 })
}

async function verifyCopyAction(page) {
  await page.getByRole('button', { name: /kopiera sammanfattning/i }).click()
  await page.getByText('Kopierad', { exact: true }).waitFor({ timeout: 15000 })

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  assertIncludes(clipboardText, 'AI-sammanfattning', 'copied summary text')
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to be present`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
