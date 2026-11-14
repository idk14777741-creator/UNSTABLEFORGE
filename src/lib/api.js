const API_BASE = import.meta.env.VITE_API_BASE || ''

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the Forge service. Check your connection.', 0, null)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // A non-JSON response is still surfaced as an error below.
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || `The Forge service returned an error (${response.status}).`,
      response.status,
      payload,
    )
  }

  return payload
}

export function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: 'GET' })
}
