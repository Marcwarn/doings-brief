export const EVALUATION_KEY_PREFIX = 'evaluation:'
export const EVALUATION_TOKEN_PREFIX = 'evaluation_token:'
export const EVALUATION_RESPONSE_PREFIX = 'evaluation_response:'
export const EVALUATION_PARTICIPANT_PREFIX = 'evaluation_participant:'

export type EvaluationMetadata = {
  id: string
  token: string
  label: string
  customer: string
  questionSetId: string
  questionSetName: string | null
  createdBy: string
  createdAt: string
}

export type EvaluationAnswer = {
  questionId: string | null
  questionText: string
  orderIndex: number
  answer: string
}

export type EvaluationResponseRecord = {
  responseId: string
  evaluationId: string
  email: string
  submittedAt: string
  answers: EvaluationAnswer[]
}

export function getEvaluationKey(id: string) {
  return `${EVALUATION_KEY_PREFIX}${id}`
}

export function getEvaluationTokenKey(token: string) {
  return `${EVALUATION_TOKEN_PREFIX}${token}`
}

export function getEvaluationResponseKey(evaluationId: string, responseId: string) {
  return `${EVALUATION_RESPONSE_PREFIX}${evaluationId}:${responseId}`
}

export function getEvaluationResponsePrefix(evaluationId: string) {
  return `${EVALUATION_RESPONSE_PREFIX}${evaluationId}:`
}

export function normalizeEvaluationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getEvaluationParticipantKey(evaluationId: string, email: string) {
  return `${EVALUATION_PARTICIPANT_PREFIX}${evaluationId}:${encodeURIComponent(normalizeEvaluationEmail(email))}`
}

export function parseEvaluationMetadata(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<EvaluationMetadata>
    if (
      !parsed
      || typeof parsed.id !== 'string'
      || typeof parsed.token !== 'string'
      || typeof parsed.label !== 'string'
      || typeof parsed.customer !== 'string'
      || typeof parsed.questionSetId !== 'string'
      || typeof parsed.createdBy !== 'string'
      || typeof parsed.createdAt !== 'string'
    ) {
      return null
    }

    return {
      id: parsed.id,
      token: parsed.token,
      label: parsed.label,
      customer: parsed.customer,
      questionSetId: parsed.questionSetId,
      questionSetName: typeof parsed.questionSetName === 'string' && parsed.questionSetName.trim() ? parsed.questionSetName.trim() : null,
      createdBy: parsed.createdBy,
      createdAt: parsed.createdAt,
    } satisfies EvaluationMetadata
  } catch {
    return null
  }
}

export function parseEvaluationResponse(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<EvaluationResponseRecord>
    if (
      !parsed
      || typeof parsed.responseId !== 'string'
      || typeof parsed.evaluationId !== 'string'
      || typeof parsed.email !== 'string'
      || typeof parsed.submittedAt !== 'string'
      || !Array.isArray(parsed.answers)
    ) {
      return null
    }

    const answers = parsed.answers
      .map(answer => {
        if (!answer || typeof answer !== 'object') return null
        const candidate = answer as Record<string, unknown>
        const questionText = typeof candidate.questionText === 'string' ? candidate.questionText.trim() : ''
        const answerText = typeof candidate.answer === 'string' ? candidate.answer.trim() : ''
        if (!questionText) return null

        return {
          questionId: typeof candidate.questionId === 'string' && candidate.questionId ? candidate.questionId : null,
          questionText,
          orderIndex: typeof candidate.orderIndex === 'number' ? candidate.orderIndex : 0,
          answer: answerText,
        } satisfies EvaluationAnswer
      })
      .filter((value): value is EvaluationAnswer => Boolean(value))
      .sort((a, b) => a.orderIndex - b.orderIndex)

    return {
      responseId: parsed.responseId,
      evaluationId: parsed.evaluationId,
      email: normalizeEvaluationEmail(parsed.email),
      submittedAt: parsed.submittedAt,
      answers,
    } satisfies EvaluationResponseRecord
  } catch {
    return null
  }
}
