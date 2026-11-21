import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import '../platform.css'

/** Public certificate verification: only the facts printed on the certificate. */
export default function CertificatePage({ code }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    document.title = 'Certificate verification — Unstable Forge'

    apiGet(`/api/certificates/${encodeURIComponent(code)}`)
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', data: payload.data })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [code])

  if (state.status === 'loading') {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">VERIFYING…</p>
        </div>
      </main>
    )
  }

  const data = state.data
  const valid = state.status === 'ready' && data?.valid === true

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <p className="pf-kicker">CERTIFICATE VERIFICATION</p>
        <h1 className="pf-title">
          {valid ? (
            <>
              This certificate <em>is genuine.</em>
            </>
          ) : (
            <>
              Not <em>verified.</em>
            </>
          )}
        </h1>

        {valid ? (
          <div className="pf-status">
            <p className="pf-status__label">ISSUED BY UNSTABLE FORGE</p>
            <h2 className="pf-status__title">{data.certificate.title}</h2>
            <div className="pf-facts" style={{ marginTop: '18px' }}>
              <p className="pf-fact">
                <span>Awarded to</span>
                <span>{data.certificate.participantName}</span>
              </p>
              <p className="pf-fact">
                <span>Event</span>
                <span>{data.certificate.eventTitle}</span>
              </p>
              <p className="pf-fact">
                <span>Certificate ID</span>
                <span>{data.certificate.certificateNo}</span>
              </p>
              <p className="pf-fact">
                <span>Issued</span>
                <span>{new Date(data.certificate.issuedAt).toLocaleDateString()}</span>
              </p>
              {data.certificate.rankPosition ? (
                <p className="pf-fact">
                  <span>Position</span>
                  <span>{data.certificate.rankPosition}</span>
                </p>
              ) : null}
            </div>
            <div className="pf-actions">
              <a className="pf-btn" href={`/api/certificates/${code}/pdf`}>
                DOWNLOAD THE PDF
              </a>
            </div>
          </div>
        ) : (
          <div className="pf-status">
            <p className="pf-status__label">
              {data?.revoked ? 'REVOKED' : 'NO MATCHING CERTIFICATE'}
            </p>
            <h2 className="pf-status__title">
              {state.status === 'error' ? 'Lookup failed' : 'This ID is not valid'}
            </h2>
            <p className="pf-status__copy">
              {state.status === 'error'
                ? state.message
                : data?.revoked
                  ? 'This certificate was issued and later revoked by the organizers, so it no longer verifies.'
                  : 'Check the certificate ID, or ask the organizers who issued it.'}
            </p>
          </div>
        )}

        <div className="pf-actions" style={{ marginTop: '28px' }}>
          <Link className="pf-btn pf-btn--ghost" to="/events">
            ALL EVENTS
          </Link>
        </div>
      </div>
    </main>
  )
}
