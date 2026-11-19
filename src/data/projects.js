export const PROJECT_CATEGORIES = ['Web', 'Mobile', 'AI / ML', 'Game', 'Tool', 'Hardware', 'Other']

export const PROJECT_STATUS = {
  draft: {
    label: 'DRAFT',
    ownerLabel: 'PRIVATE DRAFT',
    note: 'Only you can see this project.',
  },
  submitted: {
    label: 'IN REVIEW',
    ownerLabel: 'IN REVIEW',
    note: 'Submitted for organizer review. It is not public yet.',
  },
  published: {
    label: 'PUBLISHED',
    ownerLabel: 'PUBLISHED',
    note: 'Live in the public showcase.',
  },
  rejected: {
    label: 'REJECTED',
    ownerLabel: 'NOT PUBLISHED',
    note: 'The organizer did not publish this submission.',
  },
}

export function statusMeta(status) {
  return PROJECT_STATUS[status] || PROJECT_STATUS.draft
}

export function categorySlug(category) {
  return String(category || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function projectInitial(title) {
  return String(title || '?').trim().charAt(0).toUpperCase() || '?'
}

export function projectHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function descriptionParagraphs(description) {
  return String(description || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
