import { chromium } from 'playwright'

const BASE_URL = process.env.DOINGS_BRIEF_BASE_URL || 'https://doings-brief.vercel.app'
const LOGIN_EMAIL = process.env.DOINGS_BRIEF_TEST_EMAIL
const LOGIN_PASSWORD = process.env.DOINGS_BRIEF_TEST_PASSWORD

async function main() {
  requireEnv('DOINGS_BRIEF_TEST_EMAIL', LOGIN_EMAIL)
  requireEnv('DOINGS_BRIEF_TEST_PASSWORD', LOGIN_PASSWORD)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()

  const timestamp = Date.now()
  const organisation = `Smoke Batch ${timestamp}`
  const recipients = [
    `smoke-batch-${timestamp}-1@example.com`,
    `smoke-batch-${timestamp}-2@example.com`,
  ]

  try {
    await login(page)
    await verifyStartPage(page)
    await openCustomersPage(page)
    await startDispatchFromCustomers(page)
    await openSendPage(page)
    await chooseFirstQuestionSet(page)
    await fillBatchForm(page, organisation, recipients)
    await submitBatch(page, recipients.length)
    await verifyDashboardGrouping(page, organisation, recipients)
    const dispatchUrl = await openDispatchPage(page, organisation)
    await verifyDispatchPage(page, organisation, recipients)

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      organisation,
      recipients,
      dispatchUrl,
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
    page.waitForURL('**/dashboard', { timeout: 20000 }),
    page.getByRole('button', { name: /logga in/i }).click(),
  ])
}

async function openSendPage(page) {
  await page.waitForURL('**/dashboard/send**', { timeout: 15000 })
  await page.locator('input[type="radio"]').first().waitFor({ timeout: 15000 })
}

async function chooseFirstQuestionSet(page) {
  const firstRadio = page.locator('input[type="radio"]').first()
  await firstRadio.check()
}

async function fillBatchForm(page, organisation, recipients) {
  await page.locator('input[placeholder="Mojang"]').fill(organisation)
  await page.locator('textarea').fill(recipients.join('\n'))
}

async function submitBatch(page, recipientCount) {
  const button = page.getByRole('button', { name: /skicka utskick/i })
  await Promise.all([
    page.getByText(new RegExp(`${recipientCount} briefs skickade!|Brief skickad!`, 'i')).waitFor({ timeout: 20000 }),
    button.click(),
  ])
}

async function verifyDashboardGrouping(page, organisation, recipients) {
  await page.getByRole('link', { name: /se alla utskick/i }).click()
  await page.waitForURL('**/dashboard/briefs', { timeout: 15000 })
  await page.getByText(organisation, { exact: false }).waitFor({ timeout: 15000 })

  const pageText = await page.locator('body').textContent()
  assertIncludes(pageText || '', '2 totalt', 'recipient total')
  assertIncludes(pageText || '', 'Väntar: 2', 'pending count')

  await page.getByRole('button', { name: /visa personer/i }).first().click()

  for (const recipient of recipients) {
    await page.getByText(recipient, { exact: false }).waitFor({ timeout: 15000 })
  }
}

async function openDispatchPage(page, organisation) {
  const row = page.getByText(organisation, { exact: false }).first()
  await row.waitFor({ timeout: 15000 })

  const container = row.locator('xpath=ancestor::div[contains(@style, "grid-template-columns")]').first()
  const openLink = container.getByRole('link', { name: /öppna utskick/i })

  await Promise.all([
    page.waitForURL('**/dashboard/dispatches/**', { timeout: 15000 }),
    openLink.click(),
  ])

  return page.url()
}

async function verifyDispatchPage(page, organisation, recipients) {
  const main = page.locator('main')
  await page.getByRole('heading', { name: new RegExp(organisation, 'i') }).waitFor({ timeout: 15000 })
  await main.getByText('Översikt', { exact: true }).waitFor({ timeout: 15000 })
  await main.getByText('Mottagare', { exact: true }).waitFor({ timeout: 15000 })
  await main.getByText('Historik', { exact: true }).waitFor({ timeout: 15000 })

  const bodyText = await main.textContent()
  assertIncludes(bodyText || '', 'Mottagare: 2', 'dispatch recipient count')
  assertIncludes(bodyText || '', 'Svar: 0', 'dispatch submitted count')
  assertIncludes(bodyText || '', 'Väntar: 2', 'dispatch pending count')
  assertIncludes(bodyText || '', 'Utskicket skapades', 'dispatch history')

  for (const recipient of recipients) {
    await page.getByText(recipient, { exact: false }).waitFor({ timeout: 15000 })
  }
}

async function verifyStartPage(page) {
  await page.goto('/dashboard', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /start/i }).waitFor({ timeout: 15000 })

  const main = page.locator('main')
  await main.getByText('Kunddialog', { exact: true }).waitFor({ timeout: 15000 })
  await main.getByText('Frågor', { exact: true }).waitFor({ timeout: 15000 })
  await main.getByText('Mottagare', { exact: true }).waitFor({ timeout: 15000 })
  await page.locator('aside').getByRole('link', { name: /^Kunder$/i }).waitFor({ timeout: 15000 })
}

async function openCustomersPage(page) {
  await page.locator('aside').getByRole('link', { name: /^Kunder$/i }).click()
  await page.waitForURL('**/dashboard/customers', { timeout: 15000 })
  await page.getByRole('heading', { name: /kunder/i }).waitFor({ timeout: 15000 })
}

async function startDispatchFromCustomers(page) {
  await Promise.all([
    page.waitForURL('**/dashboard/send**', { timeout: 15000 }),
    page.getByRole('link', { name: /nytt utskick/i }).first().click(),
  ])
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
