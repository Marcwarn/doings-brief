import { createClient } from '@supabase/supabase-js'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const supabase = createClient(
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const consultantEmail = (process.argv[2] || process.env.DISCOVERY_DEMO_CONSULTANT_EMAIL || process.env.DOINGS_BRIEF_TEST_EMAIL || '').trim().toLowerCase()

if (!consultantEmail) {
  throw new Error('Pass consultant email as the first argument or set DISCOVERY_DEMO_CONSULTANT_EMAIL')
}

const templateBaseName = 'Leadership Survey 2026 Demo'
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const templateName = `${templateBaseName} ${timestamp}`
const organisation = 'Mojang Studios'

const sections = [
  {
    key: 'A',
    label: 'Role, context, and clarity',
    description: 'Hur tydlig rollen, riktningen och förutsättningarna känns i ledarskapet idag.',
    questions: [
      ...statement('I have a clear understanding of my role as a leader in this context.'),
      ...statement('I understand what is expected of me as a leader at Mojang.'),
      ...statement('I have enough clarity on strategic priorities to make good leadership decisions.'),
      ...statement('Communication from senior leadership gives me the context I need to lead well.'),
      ...statement('I have the conditions I need to succeed in my role as a leader.'),
      open('What most enables you to lead effectively today?'),
      open('What most gets in the way of your leadership today?'),
    ],
  },
  {
    key: 'B',
    label: 'Leadership in practice',
    description: 'Hur ledarskapet fungerar när vardagen är osäker, snabb och krävande.',
    questions: [
      ...statement('I am able to lead effectively in situations with uncertainty and change.'),
      ...statement('I know how to act when leadership is most challenging in practice.'),
      ...statement('I feel confident in my ability to lead effectively in this environment.'),
      ...statement('I am able to translate overall direction into clear priorities and actions for my team or area.'),
      open('In which situations, decisions, or interactions is leadership most difficult for you in practice?'),
    ],
  },
  {
    key: 'C',
    label: 'Decision-making, ownership, and mandate',
    description: 'Hur beslut, mandat och ansvar upplevs i praktiken.',
    questions: [
      ...statement('I am able to make decisions despite limited clarity or incomplete information.'),
      ...statement('Decision-making and ownership are clear in the organisation.'),
      ...statement('I have the mandate to make the decisions expected of me in my role.'),
      ...statement('When priorities conflict, it is clear how trade-offs should be made.'),
      ...statement('Escalation and decision-making processes support timely progress.'),
      open('Where do decisions or ownership most often get stuck?'),
      open('Where do you experience the biggest gap between responsibility and authority?'),
    ],
  },
  {
    key: 'D',
    label: 'Alignment and collaboration',
    description: 'Hur samspel mellan team och funktioner påverkar ledarskapet.',
    questions: [
      ...statement('There is sufficient alignment across teams and functions on what matters most.'),
      ...statement('Collaboration across teams and functions enables effective leadership.'),
      ...statement('Dependencies between teams are managed in a way that supports timely decisions and execution.'),
      ...statement('I am able to build alignment across stakeholders when perspectives or priorities differ.'),
      open('Where do cross-team ways of working help or hinder leadership most?'),
    ],
  },
  {
    key: 'E',
    label: 'Leadership expectations and capabilities',
    description: 'Hur tydliga förväntningar och ledarförmågor känns i organisationen.',
    questions: [
      ...statement('I understand what behaviours define sustainable leadership at Mojang.'),
      ...statement('Leadership expectations are applied consistently across the organisation.'),
      ...statement('I have the capabilities needed to lead effectively today.'),
      ...statement('I receive useful feedback that helps me grow as a leader.'),
      ...statement('I have sufficient opportunities to learn from peers and other leaders.'),
      open('Which leadership capability is most important to strengthen?'),
    ],
  },
  {
    key: 'F',
    label: 'Culture, trust, and environment',
    description: 'Hur kultur, trygghet och tillit påverkar ledarskapet i praktiken.',
    questions: [
      ...statement('The culture supports effective leadership in practice.'),
      ...statement('The behaviours rewarded in practice support good leadership.'),
      ...statement('I feel safe raising concerns or challenging decisions when needed.'),
      ...statement('Leaders can openly discuss mistakes, uncertainty, and risks without negative consequences.'),
      ...statement('There is a high level of trust between leaders across the organisation.'),
      open('What behaviours do we need more of, and less of, to strengthen leadership at Mojang?'),
    ],
  },
  {
    key: 'G',
    label: 'Support, structures, and capacity',
    description: 'Hur processer, kapacitet och stöd påverkar förmågan att leda väl.',
    questions: [
      ...statement('Processes, tools, and structures support leadership in a changing environment.'),
      ...statement('I have enough time and capacity for the leadership work expected of me.'),
      ...statement('I know where to go for support when I face difficult leadership challenges.'),
      open('What would make the biggest difference for your ability to lead effectively?'),
    ],
  },
]

const personas = [
  persona('Anna Berg', 'anna.berg', 'Executive Producer', 'Production', {
    A: answers([4, 4, 3, 3, 3], [5, 5, 5, 5, 5], ['A strong team and high trust in my immediate peers.', 'Short planning horizons and shifting priorities make it hard to keep direction stable.']),
    B: answers([4, 4, 4, 3], [5, 5, 5, 5], ['Leadership gets hardest when multiple teams depend on each other but priorities are reset late.']),
    C: answers([4, 2, 3, 2, 2], [5, 5, 5, 5, 5], ['Ownership gets stuck in cross-functional issues with product, tech, and studio leadership all involved.', 'I often carry accountability for delivery without full authority over the dependencies.']),
    D: answers([3, 3, 2, 4], [5, 4, 5, 5], ['Cross-team work helps when goals are explicit, but hinders when trade-offs are made too late.']),
    E: answers([4, 3, 4, 3, 3], [5, 4, 5, 4, 4], ['Stronger coaching in navigating ambiguity while keeping teams calm.']),
    F: answers([3, 2, 4, 3, 3], [4, 4, 5, 5, 5], ['More direct escalation and challenge. Less politeness around unclear ownership.']),
    G: answers([2, 2, 3], [5, 5, 4], ['Clearer decision forums and more protected time for leadership work.']),
  }),
  persona('Johan Lind', 'johan.lind', 'Engineering Director', 'Platform', {
    A: answers([3, 4, 2, 2, 2], [5, 5, 5, 4, 5], ['A strong local team and high technical competence make leadership easier.', 'The biggest blocker is limited strategic clarity beyond the current budget cycle.']),
    B: answers([3, 3, 3, 3], [5, 4, 5, 5], ['The hardest moments are when I need to choose between long-term health and immediate delivery pressure.']),
    C: answers([3, 2, 2, 2, 2], [5, 5, 5, 5, 4], ['Decisions get stuck when nobody owns the trade-off between product ambition and platform capacity.', 'Responsibility is high, but mandate is weaker when work spans several areas.']),
    D: answers([2, 3, 2, 3], [5, 4, 5, 4], ['Dependencies hinder leadership most when teams commit locally before aligning globally.']),
    E: answers([3, 2, 4, 2, 2], [4, 4, 5, 4, 4], ['Sharper expectations on prioritisation and cross-functional decision-making.']),
    F: answers([2, 2, 3, 3, 2], [4, 4, 5, 4, 4], ['More transparency, less reward for certainty theatre.']),
    G: answers([2, 2, 2], [5, 5, 5], ['A clearer structure for escalation and more capacity buffers.']),
  }),
  persona('Sara Nyström', 'sara.nystrom', 'Design Lead', 'Game Design', {
    A: answers([4, 4, 3, 4, 3], [5, 5, 4, 4, 4], ['Good peer collaboration and shared ambition support me.', 'Leadership gets harder when strategic changes are communicated too late.']),
    B: answers([4, 3, 4, 4], [5, 4, 5, 5], ['It is hardest when I need to align creative and delivery perspectives under time pressure.']),
    C: answers([3, 3, 3, 2, 3], [4, 4, 5, 5, 4], ['Ownership gets fuzzy in product decisions that affect several disciplines.', 'The gap appears when I am expected to align people without being part of the final decision.']),
    D: answers([4, 4, 3, 4], [5, 5, 4, 5], ['Cross-team collaboration helps when goals are framed as shared outcomes, not handovers.']),
    E: answers([4, 3, 4, 3, 4], [5, 4, 5, 4, 4], ['Facilitation of difficult alignment conversations.']),
    F: answers([4, 3, 4, 4, 4], [4, 4, 5, 5, 5], ['More open disagreement early, less silent drift.']),
    G: answers([3, 3, 4], [4, 4, 4], ['Better tooling for planning and more sparring when leadership questions get complex.']),
  }),
  persona('Marcus Eklöv', 'marcus.eklov', 'People Manager', 'People & Culture', {
    A: answers([4, 4, 3, 3, 4], [5, 5, 4, 4, 5], ['Access to leaders who are willing to reflect openly helps a lot.', 'Role clarity drops when the organisation changes faster than expectations are updated.']),
    B: answers([4, 4, 4, 3], [5, 5, 5, 4], ['Leadership is most difficult when emotional load is high and clarity is low at the same time.']),
    C: answers([3, 2, 3, 2, 2], [5, 5, 4, 5, 4], ['Decision flow gets stuck when nobody wants to own the people impact of a trade-off.', 'I often need to influence outcomes without clear formal authority.']),
    D: answers([3, 4, 3, 4], [4, 5, 4, 5], ['Cross-team work helps when leaders are explicit about interdependencies instead of assuming alignment.']),
    E: answers([4, 3, 4, 4, 3], [5, 4, 5, 5, 4], ['Capability to lead through ambiguity without creating overload.']),
    F: answers([3, 3, 4, 4, 3], [4, 4, 5, 5, 5], ['More candour and reflection, less defensive signalling.']),
    G: answers([3, 2, 4], [4, 5, 4], ['Time for reflection and structures for peer learning.']),
  }),
  persona('Linnea Holm', 'linnea.holm', 'Product Director', 'Product', {
    A: answers([3, 3, 2, 2, 2], [5, 5, 5, 4, 5], ['Clear goals within my own area make it easier to lead.', 'The biggest blocker is ambiguity across the broader system around priorities and ownership.']),
    B: answers([3, 3, 3, 2], [5, 4, 4, 5], ['Leadership gets hardest when trade-offs are urgent and the decision path is unclear.']),
    C: answers([2, 2, 2, 2, 1], [5, 5, 5, 5, 5], ['Ownership gets stuck around prioritisation between teams and functions.', 'The biggest gap is being accountable for outcomes without a decisive mandate.']),
    D: answers([2, 3, 2, 3], [5, 4, 5, 4], ['Cross-team ways of working hinder when dependencies are visible too late to act on.']),
    E: answers([3, 2, 3, 2, 2], [4, 4, 4, 4, 4], ['Sharper capability around strategic trade-off making.']),
    F: answers([2, 2, 3, 3, 2], [4, 4, 4, 4, 4], ['More constructive challenge, less ambiguity masked as alignment.']),
    G: answers([2, 2, 3], [5, 5, 4], ['A better operating rhythm and clearer escalation support.']),
  }),
  persona('David Karlsson', 'david.karlsson', 'Art Director', 'Art', {
    A: answers([4, 4, 3, 3, 3], [5, 5, 4, 4, 4], ['Strong craft identity and trust within the art leadership group.', 'The biggest blocker is when direction shifts before teams understand why.']),
    B: answers([4, 3, 4, 3], [5, 4, 5, 4], ['Leadership gets hardest when quality concerns need to be balanced against delivery pressure.']),
    C: answers([3, 2, 3, 2, 2], [4, 5, 4, 5, 4], ['Decisions slow down when several stakeholders need to sign off without one clear owner.', 'The responsibility-authority gap is biggest in cross-discipline prioritisation.']),
    D: answers([3, 4, 3, 4], [4, 5, 4, 5], ['Cross-team collaboration helps when constraints are surfaced early and owned jointly.']),
    E: answers([4, 3, 4, 3, 3], [5, 4, 5, 4, 4], ['Capability to hold direction while still adapting in change.']),
    F: answers([3, 3, 4, 4, 4], [4, 4, 5, 5, 5], ['More trust-based dialogue, less avoidance of hard calls.']),
    G: answers([3, 3, 4], [4, 4, 4], ['More predictable support structures and clearer planning horizons.']),
  }),
]

const pendingPersona = {
  name: 'Karin Sjöberg',
  email: uniqueEmail('karin.sjoberg'),
  role: 'Studio Operations Lead',
  team: 'Operations',
}

async function main() {
  const consultant = await findConsultant(consultantEmail)

  const templateId = await createTemplate(consultant)
  const { questionsBySection } = await createSectionsAndQuestions(templateId)
  const submittedSessions = await createSubmittedSessions(consultant, templateId, questionsBySection)
  const pendingSession = await createPendingSession(consultant, templateId)

  console.log(JSON.stringify({
    ok: true,
    consultantEmail,
    templateId,
    templateName,
    organisation,
    submittedSessions: submittedSessions.length,
    pendingSessionId: pendingSession.id,
    dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/dashboard/discovery`,
  }, null, 2))
}

async function findConsultant(email) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .single()

  if (profileError || !profile?.id) {
    throw new Error(`Could not find consultant profile for ${email}`)
  }

  return profile
}

async function createTemplate(consultant) {
  const { data, error } = await supabase
    .from('discovery_templates')
    .insert({
      user_id: consultant.id,
      name: templateName,
      intro_title: 'Leadership Survey 2026',
      intro_text: 'Share how leadership works in practice today, where clarity is missing, and what would make the biggest difference going forward.',
      audience_mode: 'leaders',
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Could not create discovery template: ${error?.message || 'unknown error'}`)
  }

  return data.id
}

async function createSectionsAndQuestions(templateId) {
  const insertedSections = await insertRows('discovery_sections', sections.map((section, index) => ({
    template_id: templateId,
    label: section.label,
    description: section.description,
    order_index: index,
  })), 'id, label')

  const sectionIdByLabel = new Map(insertedSections.map(section => [section.label, section.id]))
  const questionsBySection = new Map()

  for (const section of sections) {
    const sectionId = sectionIdByLabel.get(section.label)
    const insertedQuestions = await insertRows('discovery_questions', section.questions.map((question, index) => ({
      section_id: sectionId,
      type: question.type,
      text: question.text,
      order_index: index,
      max_choices: null,
      scale_min: question.type === 'scale' ? 1 : null,
      scale_max: question.type === 'scale' ? 5 : null,
      scale_min_label: question.type === 'scale' ? question.scaleMinLabel : null,
      scale_max_label: question.type === 'scale' ? question.scaleMaxLabel : null,
    })), 'id, text, type')

    questionsBySection.set(section.key, insertedQuestions.map((question, index) => ({
      ...question,
      dimension: section.questions[index].dimension || null,
    })))
  }

  return { questionsBySection }
}

async function createSubmittedSessions(consultant, templateId, questionsBySection) {
  const results = []

  for (let index = 0; index < personas.length; index += 1) {
    const person = personas[index]
    const submittedAt = new Date(Date.now() - (personas.length - index) * 36 * 60 * 60 * 1000).toISOString()
    const createdAt = new Date(Date.parse(submittedAt) - 8 * 60 * 60 * 1000).toISOString()

    const session = await insertSingle('discovery_sessions', {
      consultant_id: consultant.id,
      consultant_email: consultant.email,
      template_id: templateId,
      response_mode: 'named',
      client_name: person.name,
      client_email: person.email,
      client_organisation: organisation,
      status: 'submitted',
      created_at: createdAt,
      submitted_at: submittedAt,
    }, 'id, token')

    const submissionEntry = await insertSingle('discovery_submission_entries', {
      session_id: session.id,
      respondent_label: person.name,
      respondent_email: person.email,
      demographic_role: person.role,
      demographic_team: person.team,
      submitted_at: submittedAt,
    }, 'id')

    const responseRows = []
    for (const section of sections) {
      const insertedQuestions = questionsBySection.get(section.key)
      const answers = person.answers[section.key]
      let currentCursor = 0
      let importanceCursor = 0
      let openCursor = 0

      for (const question of insertedQuestions) {
        if (question.type === 'scale') {
          responseRows.push({
            session_id: session.id,
            submission_entry_id: submissionEntry.id,
            question_id: question.id,
            response_type: 'scale',
            scale_value: question.dimension === 'importance'
              ? answers.importance[importanceCursor]
              : answers.current[currentCursor],
            text_value: null,
            created_at: submittedAt,
          })
          if (question.dimension === 'importance') {
            importanceCursor += 1
          } else {
            currentCursor += 1
          }
        } else {
          responseRows.push({
            session_id: session.id,
            submission_entry_id: submissionEntry.id,
            question_id: question.id,
            response_type: 'open',
            text_value: answers.open[openCursor],
            scale_value: null,
            created_at: submittedAt,
          })
          openCursor += 1
        }
      }
    }

    await insertRows('discovery_responses', responseRows, 'id')
    results.push({ sessionId: session.id, token: session.token })
  }

  return results
}

async function createPendingSession(consultant, templateId) {
  return await insertSingle('discovery_sessions', {
    consultant_id: consultant.id,
    consultant_email: consultant.email,
    template_id: templateId,
    response_mode: 'named',
    client_name: pendingPersona.name,
    client_email: pendingPersona.email,
    client_organisation: organisation,
    status: 'pending',
  }, 'id, token')
}

async function insertRows(table, rows, select) {
  const { data, error } = await supabase.from(table).insert(rows).select(select)
  if (error) {
    throw new Error(`Insert into ${table} failed: ${error.message}`)
  }
  return data || []
}

async function insertSingle(table, row, select) {
  const { data, error } = await supabase.from(table).insert(row).select(select).single()
  if (error || !data) {
    throw new Error(`Insert into ${table} failed: ${error?.message || 'unknown error'}`)
  }
  return data
}

function statement(text) {
  return [
    scale('current', text, 'Håller inte med', 'Håller med'),
    scale('importance', text, 'Inte viktigt', 'Mycket viktigt'),
  ]
}

function scale(dimension, prompt, scaleMinLabel, scaleMaxLabel) {
  return {
    type: 'scale',
    dimension,
    prompt,
    text: `${dimension === 'current' ? 'Current' : 'Importance'}: ${prompt}`,
    scaleMinLabel,
    scaleMaxLabel,
  }
}

function open(text) {
  return { type: 'open', text }
}

function answers(current, importance, open) {
  return { current, importance, open }
}

function uniqueEmail(local) {
  return `${local}+${timestamp.toLowerCase()}@example.com`
}

function persona(name, emailPrefix, role, team, answers) {
  return {
    name,
    email: uniqueEmail(emailPrefix),
    role,
    team,
    answers,
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
