import { mkdir, rm, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const execFileAsync = promisify(execFile)

const BASE_URL = process.env.DOINGS_BRIEF_BASE_URL || 'https://doings-brief.vercel.app'
const LOGIN_EMAIL = process.env.DOINGS_BRIEF_TEST_EMAIL
const LOGIN_PASSWORD = process.env.DOINGS_BRIEF_TEST_PASSWORD
const RESPONSE_URL = process.env.DOINGS_BRIEF_RESPONSE_URL

async function main() {
  requireEnv('DOINGS_BRIEF_TEST_EMAIL', LOGIN_EMAIL)
  requireEnv('DOINGS_BRIEF_TEST_PASSWORD', LOGIN_PASSWORD)

  const downloadsDir = resolve('output/playwright/word-export-downloads')
  await rm(downloadsDir, { recursive: true, force: true })
  await mkdir(downloadsDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    acceptDownloads: true,
    baseURL: BASE_URL,
  })

  const page = await context.newPage()

  try {
    await login(page)
    const responsePageUrl = await openResponsePage(page)
    const expectedClientName = await readText(page, 'h1')
    const firstQuestion = await firstQuestionFromPage(page)

    const download = await triggerWordDownload(page)
    const suggestedFilename = download.suggestedFilename()
    const downloadPath = join(downloadsDir, suggestedFilename)
    await download.saveAs(downloadPath)

    if (!suggestedFilename.endsWith('.docx')) {
      throw new Error(`Expected a .docx download, got "${suggestedFilename}"`)
    }

    const fileInfo = await stat(downloadPath)
    if (fileInfo.size < 1024) {
      throw new Error(`Downloaded file is unexpectedly small (${fileInfo.size} bytes)`)
    }

    const documentXml = await extractDocumentXml(downloadPath)
    assertIncludes(documentXml, escapeXml(expectedClientName), 'client name in DOCX')

    if (firstQuestion) {
      assertIncludes(documentXml, escapeXml(firstQuestion), 'question text in DOCX')
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      responsePageUrl,
      downloadedFile: basename(downloadPath),
      bytes: fileInfo.size,
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
    await page.getByRole('button', { name: /ladda ner som word/i }).waitFor({ timeout: 15000 })
    return page.url()
  }

  await page.goto('/dashboard/briefs', { waitUntil: 'networkidle' })
  const firstResponseLink = page.getByRole('link', { name: /se svar/i }).first()
  await firstResponseLink.waitFor({ timeout: 15000 })
  await Promise.all([
    page.waitForURL('**/dashboard/briefs/**', { timeout: 15000 }),
    firstResponseLink.click(),
  ])
  await page.getByRole('button', { name: /ladda ner som word/i }).waitFor({ timeout: 15000 })
  return page.url()
}

async function triggerWordDownload(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 })
  await page.getByRole('button', { name: /ladda ner som word/i }).click()
  return await downloadPromise
}

async function readText(page, selector) {
  const text = await page.locator(selector).first().textContent()
  return (text || '').trim()
}

async function firstQuestionFromPage(page) {
  const bodyText = await page.locator('body').textContent()
  const candidates = (bodyText || '')
    .split('\n')
    .map(text => text.trim())
    .filter(Boolean)
    .filter(text => text.endsWith('?'))
    .filter(text => text.length > 10)
    .filter(text => text !== 'Radera?')

  return candidates[0] || ''
}

async function extractDocumentXml(docxPath) {
  try {
    const { stdout } = await execFileAsync('unzip', ['-p', docxPath, 'word/document.xml'], { encoding: 'utf8' })
    return stdout
  } catch (error) {
    throw new Error(`Could not read DOCX contents. Ensure "unzip" is available. ${String(error)}`)
  }
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to be present in exported DOCX`)
  }
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
