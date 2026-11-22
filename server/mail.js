/**
 * Transactional email delivery.
 *
 * Resend is used because it is an HTTPS-only API (no SDK, no SMTP socket) with a
 * free tier suitable for verification and password-reset mail. Nothing here
 * pretends a message was sent: when the provider is not configured the caller
 * receives EMAIL_NOT_CONFIGURED and the API surfaces it.
 */
const ENDPOINT = 'https://api.resend.com/emails'

export function mailConfig() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  const from = (process.env.EMAIL_FROM || '').trim()
  return {
    enabled: Boolean(apiKey && from),
    apiKey,
    from,
    appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  }
}

export async function sendMail({ to, subject, text, html }) {
  const config = mailConfig()

  if (!config.enabled) {
    const error = new Error(
      'Email delivery is not configured on this deployment. Set RESEND_API_KEY and EMAIL_FROM.',
    )
    error.code = 'EMAIL_NOT_CONFIGURED'
    throw error
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.from, to: [to], subject, text, html }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.message || 'The email provider rejected the message.')
    error.code = 'EMAIL_SEND_FAILED'
    error.status = response.status
    throw error
  }

  return { id: payload?.id ?? null }
}

export function verificationEmail({ name, url }) {
  const greeting = name ? `Hello ${name},` : 'Hello,'
  return {
    subject: 'Confirm your UNSTABLE FORGE account',
    text: `${greeting}\n\nConfirm your email address to finish setting up your account:\n${url}\n\nThis link expires in 24 hours. If you did not create an account, ignore this message.`,
    html: `<p>${greeting}</p><p>Confirm your email address to finish setting up your account.</p><p><a href="${url}">Confirm email</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this message.</p>`,
  }
}

export function resetEmail({ name, url }) {
  const greeting = name ? `Hello ${name},` : 'Hello,'
  return {
    subject: 'Reset your UNSTABLE FORGE password',
    text: `${greeting}\n\nUse this link to choose a new password:\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not ask for a reset, ignore this message.`,
    html: `<p>${greeting}</p><p>Use this link to choose a new password.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 30 minutes and can be used once. If you did not ask for a reset, ignore this message.</p>`,
  }
}
