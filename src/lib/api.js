const API_BASE = import.meta.env.VITE_API_BASE || ''

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export async function apiGet(path, { signal } = {}) {
  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the updates service. Check your connection.', 0, null)
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // A non-JSON response is still surfaced as an error below.
  }

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || `The updates service returned an error (${response.status}).`,
      response.status,
      body,
    )
  }

  return body
}
