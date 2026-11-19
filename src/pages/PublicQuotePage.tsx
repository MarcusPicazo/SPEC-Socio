import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button, buttonClassName } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
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
        <p className="text-center text-sm text-gris-texto">Loading…</p>
      </PageShell>
    )
  }

  if (error || !quote) {
    return (
      <PageShell>
        <p className="text-center text-sm text-gris-texto">{error ?? 'Quote not found.'}</p>
      </PageShell>
    )
  }

  const pdfUrl = quote.pdf_path ? getQuotePdfUrl(quote.pdf_path) : null
  const isAccepted = quote.status === 'accepted'

  return (
    <PageShell>
      <header>
        <h1 className="text-[22px] font-medium tracking-[-0.03em] text-tinta">{quote.business.name}</h1>
        <p className="text-sm text-gris-texto">
          {quote.business.trade} · {quote.business.city}, {quote.business.state}
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gris-texto">Quote</span>
          <span className="font-medium text-tinta">{quote.number}</span>
        </div>
        {quote.customer.name && (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-gris-texto">Prepared for</span>
            <span className="text-tinta">{quote.customer.name}</span>
          </div>
        )}
        {quote.valid_until && (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-gris-texto">Valid until</span>
            <span className="text-tinta">{formatDateEn(quote.valid_until)}</span>
          </div>
        )}
      </Card>

      <Card title="Items">
        <ul className="divide-y divide-linea">
          {quote.items.map((item, index) => (
            <li key={index} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="text-sm text-tinta">{item.description_en}</p>
                <p className="text-xs text-gris-texto">
                  {item.qty} {item.unit} × {formatMoney(item.unit_price, quote.currency)}
                </p>
              </div>
              <span className="whitespace-nowrap font-medium text-tinta">
                {formatMoney(item.total, quote.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-linea pt-3 text-sm">
          <div className="flex justify-between text-gris-texto">
            <span>Subtotal</span>
            <span>{formatMoney(quote.subtotal, quote.currency)}</span>
          </div>
          {quote.tax > 0 && (
            <div className="flex justify-between text-gris-texto">
              <span>Tax</span>
              <span>{formatMoney(quote.tax, quote.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-medium text-tinta">
            <span>Total</span>
            <span>{formatMoney(quote.total, quote.currency)}</span>
          </div>
        </div>
      </Card>

      {quote.warranty_en && (
        <Card title="Warranty">
          <p className="text-sm text-tinta">{quote.warranty_en}</p>
        </Card>
      )}

      {quote.notes_en && (
        <Card title="Notes">
          <p className="text-sm text-tinta">{quote.notes_en}</p>
        </Card>
      )}

      <div className="space-y-2 pb-6">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({ variant: 'secondary', className: 'w-full' })}
          >
            Download PDF
          </a>
        )}

        {isAccepted ? (
          <div className="flex w-full items-center justify-center py-3">
            <Badge variant="exito">Accepted</Badge>
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={handleAccept} disabled={accepting}>
            {accepting ? 'Accepting…' : 'Accept'}
          </Button>
        )}
        {acceptError && <p className="text-center text-sm text-error">{acceptError}</p>}
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-papel px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">{children}</div>
    </div>
  )
}
