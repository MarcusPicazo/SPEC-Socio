// English, customer-facing quote PDF. Underscore-prefixed folder so
// Vercel's zero-config Node builder treats this as a shared module, not
// its own route — only api/quote-pdf.ts is an endpoint.
// Explicit import, not just relying on the automatic JSX runtime — this
// file's JSX transform mode isn't guaranteed by any tsconfig Vercel's
// builder is certain to pick up for api/, so don't depend on it.
import React from 'react'
import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { QuoteItem } from '../../src/types.js'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 20 },
  businessName: { fontSize: 18, fontWeight: 700 },
  muted: { color: '#6b7280', fontSize: 10 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnitPrice: { flex: 1.3, textAlign: 'right' },
  colTotal: { flex: 1.3, textAlign: 'right' },
  totalsBlock: { marginTop: 12, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', marginBottom: 2 },
  grandTotal: { fontSize: 13, fontWeight: 700 },
  footer: { marginTop: 24, fontSize: 9, color: '#6b7280' },
  link: { color: '#2563eb' },
})

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(isoOrDateOnly: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(isoOrDateOnly))
}

export interface QuoteDocumentProps {
  businessName: string
  businessTrade: string
  businessCity: string
  businessState: string
  customerName: string
  number: string
  items: QuoteItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  warrantyEn: string | null
  notesEn: string | null
  validUntil: string
  publicUrl: string
}

export function QuoteDocument(props: QuoteDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.businessName}>{props.businessName}</Text>
          <Text style={styles.muted}>
            {props.businessTrade} · {props.businessCity}, {props.businessState}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.sectionTitle}>Quote</Text>
              <Text>{props.number}</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Prepared for</Text>
              <Text>{props.customerName}</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Valid until</Text>
              <Text>{formatDate(props.validUntil)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.sectionTitle]}>Description</Text>
            <Text style={[styles.colQty, styles.sectionTitle]}>Qty</Text>
            <Text style={[styles.colUnitPrice, styles.sectionTitle]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.sectionTitle]}>Total</Text>
          </View>
          {props.items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={styles.colDescription}>
                {item.description_en} ({item.unit})
              </Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnitPrice}>{formatMoney(item.unit_price, props.currency)}</Text>
              <Text style={styles.colTotal}>{formatMoney(item.total, props.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(props.subtotal, props.currency)}</Text>
          </View>
          {props.tax > 0 && (
            <View style={styles.totalsRow}>
              <Text>Tax</Text>
              <Text>{formatMoney(props.tax, props.currency)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>{formatMoney(props.total, props.currency)}</Text>
          </View>
        </View>

        {props.warrantyEn && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warranty</Text>
            <Text>{props.warrantyEn}</Text>
          </View>
        )}

        {props.notesEn && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{props.notesEn}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>This quote is valid until {formatDate(props.validUntil)}.</Text>
          <Text>
            View and accept online:{' '}
            <Link style={styles.link} src={props.publicUrl}>
              {props.publicUrl}
            </Link>
          </Text>
        </View>
      </Page>
    </Document>
  )
}
