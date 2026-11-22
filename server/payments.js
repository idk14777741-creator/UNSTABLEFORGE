/**
 * Razorpay integration.
 *
 * Everything security-relevant happens here or on the server route that calls
 * it. The browser never decides that a payment succeeded: an order is created
 * server-side, the callback signature is verified against the key secret, and
 * the payment's status is fetched from Razorpay before a registration is
 * confirmed.
 */
import crypto from 'node:crypto'

const API = 'https://api.razorpay.com/v1'

export function razorpayConfig() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim()
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim()
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim()

  return {
    keyId,
    keySecret,
    webhookSecret,
    enabled: Boolean(keyId && keySecret),
    // Razorpay's hosted checkout offers whatever the merchant account has
    // enabled. These are the standard instruments it presents when active.
    methods: ['UPI (including QR)', 'Debit and credit cards', 'Net banking', 'Wallets'],
    mode: keyId.startsWith('rzp_live_') ? 'live' : 'test',
  }
}

function authHeader() {
  const { keyId, keySecret } = razorpayConfig()
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

async function request(path, { method = 'GET', body } = {}) {
  const { enabled } = razorpayConfig()
  if (!enabled) {
    const error = new Error('The payment gateway is not configured on this deployment.')
    error.code = 'PAYMENT_NOT_CONFIGURED'
    throw error
  }

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(
      payload?.error?.description || 'The payment gateway rejected the request.',
    )
    error.code = 'PAYMENT_GATEWAY_ERROR'
    error.status = response.status
    throw error
  }

  return payload
}

export function createOrder({ amountMinor, currency = 'INR', receipt, notes }) {
  return request('/orders', {
    method: 'POST',
    body: { amount: amountMinor, currency, receipt, notes, payment_capture: 1 },
  })
}

export function fetchPayment(paymentId) {
  return request(`/payments/${encodeURIComponent(paymentId)}`)
}

function safeEqual(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Razorpay checkout signature: HMAC-SHA256(`${order_id}|${payment_id}`). */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const { keySecret } = razorpayConfig()
  if (!keySecret || !orderId || !paymentId || !signature) return false
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeEqual(expected, signature)
}

/** Webhook signature: HMAC-SHA256 of the exact request body, hex encoded. */
export function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = razorpayConfig()
  if (!webhookSecret || typeof rawBody !== 'string' || !signature) return false
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}
