import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'

type DiscoverySubmitPayload = {
  token?: unknown
  responses?: unknown
  demographicRole?: unknown
  demographicTeam?: unknown
}

type SubmittedResponse = {
  questionId: string
  responseType: 'open' | 'choice' | 'scale' | 'likert'
  textValue: string | null
  scaleValue: number | null
  likertAgreement: number | null
  likertImportance: number | null
  selectedOptions: string[]
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asIntegerOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function escHtml(value: string) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeSubmittedResponses(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { responses: [] as SubmittedResponse[], error: 'Inga svar skickades.' }
  }

  const responses: SubmittedResponse[] = []

  for (let index = 0; index < value.length; index += 1) {
    const rawItem = value[index]
    if (!rawItem || typeof rawItem !== 'object') {
      return { responses: [] as SubmittedResponse[], error: `Svar ${index + 1} är ogiltigt.` }
    }

    const item = rawItem as Record<string, unknown>
    const questionId = asTrimmedString(item.questionId)
    const responseType = item.responseType === 'choice' || item.responseType === 'scale' || item.responseType === 'likert' ? item.responseType : 'open'
    const textValue = responseType === 'open' ? asTrimmedString(item.textValue) : ''
    const scaleValue = responseType === 'scale' ? asIntegerOrNull(item.scaleValue) : null
    const likertAgreement = responseType === 'likert' ? asIntegerOrNull(item.likertAgreement) : null
    const likertImportance = responseType === 'likert' ? asIntegerOrNull(item.likertImportance) : null
    const selectedOptions = responseType === 'choice' && Array.isArray(item.selectedOptions)
      ? item.selectedOptions.map(option => asTrimmedString(option)).filter(Boolean)
      : []

    if (!questionId) {
      return { responses: [] as SubmittedResponse[], error: `Svar ${index + 1} saknar fråga.` }
    }

    if (responseType === 'open' && !textValue) {
      return { responses: [] as SubmittedResponse[], error: 'Alla öppna frågor måste ha ett svar.' }
    }

    if (responseType === 'scale' && scaleValue === null) {
      return { responses: [] as SubmittedResponse[], error: 'Alla skalfrågor måste ha ett värde.' }
    }

    if (responseType === 'likert' && (likertAgreement === null || likertImportance === null)) {
      return { responses: [] as SubmittedResponse[], error: 'Likert-svar saknar värde.' }
    }

    if (responseType === 'choice' && selectedOptions.length === 0) {
      return { responses: [] as SubmittedResponse[], error: 'Alla valfrågor måste ha minst ett valt alternativ.' }
    }

    responses.push({
      questionId,
      responseType,
      textValue: responseType === 'open' ? textValue : null,
      scaleValue,
      likertAgreement,
      likertImportance,
      selectedOptions,
    })
  }

  return { responses, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const admin = getSupabaseAdminClient()
    const resend = getResendClient()
    const payload = await req.json() as DiscoverySubmitPayload
    const token = asTrimmedString(payload.token)
    const demographicRole = asTrimmedString(payload.demographicRole) || null
    const demographicTeam = asTrimmedString(payload.demographicTeam) || null

    if (!token) {
      return NextResponse.json({ error: 'Länken är ogiltig.' }, { status: 400 })
    }

    const { responses, error: responseError } = normalizeSubmittedResponses(payload.responses)
    if (responseError) {
      return NextResponse.json({ error: responseError }, { status: 400 })
    }

    const { data: session, error: sessionError } = await admin
      .from('discovery_sessions')
      .select('id, template_id, consultant_email, response_mode, client_name, client_email, client_organisation, status')
      .eq('token', token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sidan hittades inte.' }, { status: 404 })
    }

    if (session.response_mode === 'named' && session.status === 'submitted') {
      return NextResponse.json({ error: 'Det här formuläret har redan skickats in.' }, { status: 409 })
    }

    const [
      { data: template, error: templateError },
      { data: sections, error: sectionsError },
      { data: profile },
    ] = await Promise.all([
      admin
        .from('discovery_templates')
        .select('id, intro_title')
        .eq('id', session.template_id)
        .single(),
      admin
        .from('discovery_sections')
        .select('id')
        .eq('template_id', session.template_id),
      session.consultant_email
        ? admin
            .from('profiles')
            .select('full_name, sender_email')
            .eq('email', session.consultant_email)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (templateError || !template) {
      console.error('discovery submit template error:', templateError)
      return NextResponse.json({ error: 'Kunde inte verifiera upplägget.' }, { status: 500 })
    }

    if (sectionsError) {
      console.error('discovery submit sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera upplägget.' }, { status: 500 })
    }

    const sectionIds = (sections || []).map(section => section.id)
    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, type, max_choices, scale_min, scale_max')
          .in('section_id', sectionIds)
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery submit questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)
    if (responses.length !== questionIds.length) {
      return NextResponse.json({ error: 'Alla frågor måste besvaras innan du skickar.' }, { status: 400 })
    }

    const { data: options, error: optionsError } = questionIds.length > 0
      ? await admin
          .from('discovery_question_options')
          .select('question_id, label')
          .in('question_id', questionIds)
      : { data: [], error: null }

    if (optionsError) {
      console.error('discovery submit options error:', optionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera alternativen för frågorna.' }, { status: 500 })
    }

    const questionById = new Map((questions || []).map(question => [question.id, question]))
    const optionLabelsByQuestionId = new Map<string, Set<string>>()

    for (const option of options || []) {
      const bucket = optionLabelsByQuestionId.get(option.question_id) || new Set<string>()
      bucket.add(option.label)
      optionLabelsByQuestionId.set(option.question_id, bucket)
    }

    for (const response of responses) {
      const question = questionById.get(response.questionId)
      if (!question) {
        return NextResponse.json({ error: 'Ett eller flera svar matchar inte upplägget.' }, { status: 400 })
      }

      if (question.type !== response.responseType) {
        return NextResponse.json({ error: 'Svarstypen matchar inte frågan.' }, { status: 400 })
      }

      if (response.responseType === 'likert') {
        if (response.likertAgreement === null || response.likertAgreement === undefined ||
            response.likertImportance === null || response.likertImportance === undefined) {
          return NextResponse.json({ error: 'Likert-svar saknar värde.' }, { status: 400 })
        }
      }

      if (response.responseType === 'choice') {
        const allowedOptions = optionLabelsByQuestionId.get(response.questionId) || new Set<string>()
        if (response.selectedOptions.some(option => !allowedOptions.has(option))) {
          return NextResponse.json({ error: 'Ett eller flera val är ogiltiga.' }, { status: 400 })
        }

        if (question.max_choices !== null && response.selectedOptions.length > question.max_choices) {
          return NextResponse.json({ error: 'Du har valt för många alternativ i en fråga.' }, { status: 400 })
        }
      }

      if (response.responseType === 'scale') {
        if (
          response.scaleValue === null
          || question.scale_min === null
          || question.scale_max === null
          || response.scaleValue < question.scale_min
          || response.scaleValue > question.scale_max
        ) {
          return NextResponse.json({ error: 'Ett skalvärde är ogiltigt.' }, { status: 400 })
        }
      }
    }

    const submissionLabel = session.response_mode === 'anonymous'
      ? (demographicRole && demographicTeam
          ? `${demographicRole} · ${demographicTeam}`
          : demographicRole || demographicTeam || 'Anonymt svar')
      : session.client_name

    const { data: submissionEntry, error: submissionEntryError } = await admin
      .from('discovery_submission_entries')
      .insert({
        session_id: session.id,
        respondent_label: submissionLabel,
        respondent_email: session.response_mode === 'named' ? session.client_email : null,
        demographic_role: demographicRole,
        demographic_team: demographicTeam,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (submissionEntryError || !submissionEntry) {
      console.error('discovery submit submission entry error:', submissionEntryError)
      return NextResponse.json({ error: 'Kunde inte spara svarstillfället.' }, { status: 500 })
    }

    const { data: insertedResponses, error: insertResponsesError } = await admin
      .from('discovery_responses')
      .insert(responses.map(response => ({
        session_id: session.id,
        submission_entry_id: submissionEntry.id,
        question_id: response.questionId,
        response_type: response.responseType,
        text_value: response.textValue,
        scale_value: response.scaleValue,
        likert_agreement: response.likertAgreement ?? null,
        likert_importance: response.likertImportance ?? null,
      })))
      .select('id, question_id')

    if (insertResponsesError || !insertedResponses) {
      console.error('discovery submit insert responses error:', insertResponsesError)
      return NextResponse.json({ error: 'Kunde inte spara svaren.' }, { status: 500 })
    }

    const responseIdByQuestionId = new Map(insertedResponses.map(item => [item.question_id, item.id]))
    const optionRows = responses.flatMap(response => {
      if (response.responseType !== 'choice') return []
      const responseId = responseIdByQuestionId.get(response.questionId)
      if (!responseId) return []

      return response.selectedOptions.map(option => ({
        response_id: responseId,
        option_label: option,
      }))
    })

    if (optionRows.length > 0) {
      const { error: insertOptionsError } = await admin
        .from('discovery_response_options')
        .insert(optionRows)

      if (insertOptionsError) {
        console.error('discovery submit insert options error:', insertOptionsError)
        return NextResponse.json({ error: 'Kunde inte spara alla valda alternativ.' }, { status: 500 })
      }
    }

    const { error: sessionUpdateError } = await admin
      .from('discovery_sessions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (sessionUpdateError) {
      console.error('discovery submit session update error:', sessionUpdateError)
      return NextResponse.json({ error: 'Kunde inte avsluta formuläret.' }, { status: 500 })
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/dashboard/discovery`
    const senderName = profile?.full_name || 'Doings'
    const senderEmail = profile?.sender_email || process.env.FROM_EMAIL || 'brief@doingsclients.se'

    if (session.consultant_email) {
      const organisationLine = session.client_organisation
        ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.58);">${escHtml(session.client_organisation)}</p>`
        : ''
      const identityHeading = session.response_mode === 'anonymous'
        ? 'Anonymt Discovery-svar'
        : escHtml(session.client_name)
      const identitySubline = session.response_mode === 'anonymous'
        ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.58);">${escHtml([demographicRole, demographicTeam].filter(Boolean).join(' · ') || 'Delbar anonym länk')}</p>`
        : `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.58);">${escHtml(session.client_email)}</p>`
      const notifyText = session.response_mode === 'anonymous'
        ? 'Ett nytt anonymt Discovery-svar har kommit in. Öppna Discovery-data för att läsa svaren i sitt sammanhang och se hur de påverkar helhetsbilden.'
        : 'Ett nytt Discovery-svar har kommit in. Öppna svaret i dashboarden för att läsa alla teman och svar i sin helhet.'

      const { error: emailError } = await resend.emails.send({
        from: `${senderName} <${senderEmail}>`,
        to: session.consultant_email,
        subject: session.response_mode === 'anonymous'
          ? `Anonymt Discovery-svar – ${session.client_organisation || template.intro_title || 'Perspektiv'}`
          : `Discovery besvarad – ${session.client_name}`,
        html: `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:28px 32px;">
            <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,.62);letter-spacing:.01em;">Discovery besvarad</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${identityHeading}</h1>
            ${identitySubline}
            ${organisationLine}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 24px;">
            <p style="margin:0 0 12px;font-size:14px;color:#5e5873;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Upplägg</p>
            <p style="margin:0 0 18px;font-size:18px;color:#1a1a2e;font-weight:700;">${escHtml(template.intro_title || 'Perspektiv')}</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#4a4458;">
              ${notifyText}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;text-align:center;background:#f5f4f8;border-top:1px solid #e8d9f0;">
            <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#6b2d82,#C62368);color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
              Öppna Discovery →
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        text: session.response_mode === 'anonymous'
          ? `Anonymt Discovery-svar har kommit in.\n\nUpplägg: ${template.intro_title || 'Perspektiv'}${session.client_organisation ? `\nOrganisation: ${session.client_organisation}` : ''}${demographicRole ? `\nRoll: ${demographicRole}` : ''}${demographicTeam ? `\nTeam/enhet: ${demographicTeam}` : ''}\n\nÖppna Discovery i dashboarden:\n${dashboardUrl}`
          : `Discovery besvarad av ${session.client_name}\n\nUpplägg: ${template.intro_title || 'Perspektiv'}\nE-post: ${session.client_email}${session.client_organisation ? `\nOrganisation: ${session.client_organisation}` : ''}\n\nÖppna svaret i dashboarden:\n${dashboardUrl}`,
      })

      if (emailError) {
        console.error('discovery submit notify email error:', JSON.stringify(emailError))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('discovery submit fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
