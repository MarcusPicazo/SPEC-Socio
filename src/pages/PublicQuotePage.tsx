import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { formatDateEn, formatMoney } from '../lib/format'
import { acceptPublicQuote, getPublicQuote, getQuotePdfUrl, markQuoteViewed } from '../lib/publicQuote'
import type { PublicQuote } from '../types'

export function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true

    getPublicQuote(token)
      .then((data) => {
        if (!active) return
        if (!data) {
          setError("We couldn't find this quote. The link may be incorrect or expired.")
          return
        }
        setQuote(data)
        markQuoteViewed(token).catch(() => {
          // Best-effort — not marking the view shouldn't block the page.
        })
      })
      .catch(() => {
        if (active) setError('Something went wrong loading this quote. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function handleAccept() {
    if (!token) return
    setAccepting(true)
    setAcceptError(null)
    try {
      await acceptPublicQuote(token)
      setQuote((current) =>
        current ? { ...current, status: 'accepted', accepted_at: new Date().toISOString() } : current,
      )
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Could not accept the quote. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <p className="text-center text-gray-500">Loading…</p>
      </PageShell>
    )
  }

  if (error || !quote) {
    return (
      <PageShell>
        <p className="text-center text-gray-600">{error ?? 'Quote not found.'}</p>
      </PageShell>
    )
  }

  const pdfUrl = quote.pdf_path ? getQuotePdfUrl(quote.pdf_path) : null
  const isAccepted = quote.status === 'accepted'

  return (
    <PageShell>
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{quote.business.name}</h1>
        <p className="text-sm text-gray-500">
          {quote.business.trade} · {quote.business.city}, {quote.business.state}
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Quote</span>
          <span className="font-medium text-gray-900">{quote.number}</span>
        </div>
        {quote.customer.name && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-gray-500">Prepared for</span>
            <span className="text-gray-900">{quote.customer.name}</span>
          </div>
        )}
        {quote.valid_until && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-gray-500">Valid until</span>
            <span className="text-gray-900">{formatDateEn(quote.valid_until)}</span>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Items</h2>
        <ul className="divide-y divide-gray-100">
          {quote.items.map((item, index) => (
            <li key={index} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="text-sm text-gray-900">{item.description_en}</p>
                <p className="text-xs text-gray-500">
                  {item.qty} {item.unit} × {formatMoney(item.unit_price, quote.currency)}
                </p>
              </div>
              <span className="whitespace-nowrap font-medium text-gray-900">
                {formatMoney(item.total, quote.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatMoney(quote.subtotal, quote.currency)}</span>
          </div>
          {quote.tax > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatMoney(quote.tax, quote.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatMoney(quote.total, quote.currency)}</span>
          </div>
        </div>
      </section>

      {quote.warranty_en && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Warranty</h2>
          <p className="text-sm text-gray-700">{quote.warranty_en}</p>
        </section>
      )}

      {quote.notes_en && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Notes</h2>
          <p className="text-sm text-gray-700">{quote.notes_en}</p>
        </section>
      )}

      <div className="space-y-2 pb-6">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-lg border border-gray-300 bg-white py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download PDF
          </a>
        )}

        {isAccepted ? (
          <div className="rounded-lg bg-green-50 py-3 text-center text-sm font-medium text-green-700">
            ✓ Accepted
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="block w-full rounded-lg bg-gray-900 py-3 text-center text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {accepting ? 'Accepting…' : 'Accept'}
          </button>
        )}
        {acceptError && <p className="text-center text-sm text-red-600">{acceptError}</p>}
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">{children}</div>
    </div>
  )
}
