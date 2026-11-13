export const CATEGORIES = ['All', 'Important', 'Registration', 'Schedule', 'Competition', 'General']

export const PAGE_SIZE = 6

export function formatDate(value) {
  if (!value) return 'UNPUBLISHED'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'DATE TBA'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .toUpperCase()
}
