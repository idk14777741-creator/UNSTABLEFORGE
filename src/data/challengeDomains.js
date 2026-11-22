/**
 * Challenge domains shown in the constellation.
 *
 * These are areas of possibility, not official problem statements.
 *
 * Fallback only: the brief now loads the C³ domains from the event API, so the
 * `event_domains` rows are the source of truth and the constellation and the
 * brief cannot drift. This list mirrors the seeded rows (same titles, same
 * order, same notes) and is used only when that API cannot be reached. Keep it
 * in step with `C3_DOMAINS` in `server/platform/seed.js`.
 */
export const challengeDomains = [
  {
    id: 'agentic-ai',
    name: 'Agentic AI',
    note: 'Systems that plan, act and keep working without a hand on the wheel.',
  },
  {
    id: 'fintech',
    name: 'FinTech',
    note: 'Money moved, measured and made safer.',
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    note: 'Defence built into the product, not bolted on afterwards.',
  },
  {
    id: 'smart-automation',
    name: 'Smart Automation',
    note: 'Machines taking the repetition out of real work.',
  },
  {
    id: 'road-safety',
    name: 'Road Safety',
    note: 'Fewer blind spots between here and there.',
  },
  {
    id: 'women-safety',
    name: 'Women Safety',
    note: 'Safer streets, safer commutes, faster help.',
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    note: 'Better decisions for the people who grow things.',
  },
  {
    id: 'genai',
    name: 'GenAI',
    note: 'Tools that generate, and stay answerable to the people using them.',
  },
  {
    id: 'govtech',
    name: 'GovTech',
    note: 'Public services that behave like good products.',
  },
  {
    id: 'edutech',
    name: 'EduTech',
    note: 'Learning that adapts to the learner.',
  },
  {
    id: 'healthcare',
    name: 'HealthCare',
    note: 'Care that reaches further and waits less.',
  },
]

export const domainDisclaimer = 'Challenge domains — not official problem statements.'
