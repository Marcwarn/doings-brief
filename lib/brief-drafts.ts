export const BRIEF_DRAFT_KEY_PREFIX = 'brief_draft:'

export type BriefDraftQuestion = {
  text: string
}

export type BriefDraftMetadata = {
  id: string
  label: string
  organisation: string
  introTitle: string
  introText: string
  contextNote: string
  selectedSet: string | null
  customSetName: string
  customQuestions: BriefDraftQuestion[]
  recipientsInput: string
  activeTab: 'setup' | 'questions' | 'send'
  activePreviewQuestionIndex: number
  createdBy: string
  createdAt: string
  updatedAt: string
  status: 'draft'
}

export function getBriefDraftKey(id: string) {
  return `${BRIEF_DRAFT_KEY_PREFIX}${id}`
}

export function parseBriefDraftMetadata(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<BriefDraftMetadata>
    if (
      !parsed
      || typeof parsed.id !== 'string'
      || typeof parsed.label !== 'string'
      || typeof parsed.organisation !== 'string'
      || typeof parsed.introTitle !== 'string'
      || typeof parsed.introText !== 'string'
      || typeof parsed.contextNote !== 'string'
      || typeof parsed.customSetName !== 'string'
      || typeof parsed.recipientsInput !== 'string'
      || typeof parsed.createdBy !== 'string'
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.updatedAt !== 'string'
    ) {
      return null
    }

    const customQuestions = Array.isArray(parsed.customQuestions)
      ? parsed.customQuestions
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const candidate = item as Record<string, unknown>
            const text = typeof candidate.text === 'string' ? candidate.text.trim() : ''
            if (!text) return null
            return { text } satisfies BriefDraftQuestion
          })
          .filter((value): value is BriefDraftQuestion => Boolean(value))
      : []

    return {
      id: parsed.id,
      label: parsed.label.trim() || 'Utkast',
      organisation: parsed.organisation.trim(),
      introTitle: parsed.introTitle,
      introText: parsed.introText,
      contextNote: parsed.contextNote,
      selectedSet: typeof parsed.selectedSet === 'string' && parsed.selectedSet.trim() ? parsed.selectedSet.trim() : null,
      customSetName: parsed.customSetName,
      customQuestions,
      recipientsInput: parsed.recipientsInput,
      activeTab: parsed.activeTab === 'questions' || parsed.activeTab === 'send' ? parsed.activeTab : 'setup',
      activePreviewQuestionIndex: typeof parsed.activePreviewQuestionIndex === 'number' ? parsed.activePreviewQuestionIndex : 0,
      createdBy: parsed.createdBy,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      status: 'draft',
    } satisfies BriefDraftMetadata
  } catch {
    return null
  }
}
