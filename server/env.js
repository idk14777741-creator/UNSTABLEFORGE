import fs from 'node:fs'
import path from 'node:path'

/**
 * Minimal .env loader so the API can run with `node server/index.js`.
 * Existing process environment variables always win.
 */
export function loadEnv() {
  const file = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(file)) return

  const contents = fs.readFileSync(file, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
