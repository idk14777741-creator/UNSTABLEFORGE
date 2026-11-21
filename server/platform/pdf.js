/**
 * Minimal certificate PDF writer.
 *
 * Certificates are single-page A4 landscape documents with text, rules and a
 * border — a real, downloadable PDF that needs no native dependency. If the
 * design later grows images or custom fonts, this is the one place to replace.
 */

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595

function escapeText(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function textLine({ x, y, size = 12, font = 'F1', value, align = 'left' }) {
  const content = escapeText(value)
  // Helvetica averages ~0.5em per character; good enough for centring labels.
  const estimatedWidth = content.length * size * 0.5
  const originX =
    align === 'center' ? Math.round((PAGE_WIDTH - estimatedWidth) / 2) : align === 'right' ? x - estimatedWidth : x

  return `BT /${font} ${size} Tf 1 0 0 1 ${originX} ${y} Tm (${content}) Tj ET`
}

function rule({ x, y, width, thickness = 1 }) {
  return `${thickness} w ${x} ${y} m ${x + width} ${y} l S`
}

/**
 * @param {object} certificate
 * @param {string} certificate.title      e.g. "Certificate of Participation"
 * @param {string} certificate.name       participant's full name
 * @param {string} certificate.eventTitle
 * @param {string} [certificate.eventDate]
 * @param {string} certificate.certificateNo
 * @param {string} certificate.verificationUrl
 * @param {number} [certificate.rankPosition]
 */
export function renderCertificatePdf(certificate) {
  const operations = [
    '0.06 0.05 0.05 RG',
    `${3} w 28 28 ${PAGE_WIDTH - 56} ${PAGE_HEIGHT - 56} re S`,
    `0.8 w 40 40 ${PAGE_WIDTH - 80} ${PAGE_HEIGHT - 80} re S`,

    textLine({ x: 0, y: 508, size: 11, value: 'UNSTABLE FORGE', align: 'center' }),
    textLine({
      x: 0,
      y: 492,
      size: 8,
      value: certificate.eventTitle.toUpperCase(),
      align: 'center',
    }),
    rule({ x: PAGE_WIDTH / 2 - 40, y: 478, width: 80, thickness: 0.8 }),

    textLine({ x: 0, y: 438, size: 26, font: 'F2', value: certificate.title, align: 'center' }),

    textLine({ x: 0, y: 398, size: 9, value: 'THIS CERTIFICATE IS PRESENTED TO', align: 'center' }),
    textLine({
      x: 0,
      y: 356,
      size: 30,
      font: 'F2',
      value: certificate.name,
      align: 'center',
    }),
    rule({ x: PAGE_WIDTH / 2 - 140, y: 342, width: 280, thickness: 0.6 }),

    textLine({
      x: 0,
      y: 312,
      size: 11,
      value: certificate.rankPosition
        ? `for securing position ${certificate.rankPosition} at`
        : 'for taking part in',
      align: 'center',
    }),
    textLine({
      x: 0,
      y: 292,
      size: 14,
      font: 'F2',
      value: certificate.eventTitle,
      align: 'center',
    }),

    ...(certificate.eventDate
      ? [textLine({ x: 0, y: 268, size: 9, value: certificate.eventDate, align: 'center' })]
      : []),

    textLine({ x: 72, y: 116, size: 8, value: `Certificate ID  ${certificate.certificateNo}` }),
    textLine({ x: 72, y: 102, size: 8, value: `Verify at  ${certificate.verificationUrl}` }),
    textLine({
      x: PAGE_WIDTH - 72,
      y: 116,
      size: 8,
      value: `Issued  ${new Date(certificate.issuedAt).toISOString().slice(0, 10)}`,
      align: 'right',
    }),
    textLine({ x: PAGE_WIDTH - 72, y: 102, size: 8, value: 'UNSTABLE FORGE — ALTA', align: 'right' }),
  ]

  const stream = operations.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}
