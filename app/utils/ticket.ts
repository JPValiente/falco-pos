import type { Catalog, LocalSale } from '~/types/pos'
import { PAYMENT_METHODS } from '~/types/pos'

export type PaperWidth = 58 | 80

/** Characters per line of each roll with the printer's standard font. */
export const COLUMNS: Record<PaperWidth, number> = { 58: 32, 80: 48 }

/** A printed line; {@code big}/{@code bold}/{@code center} are honored by ESC/POS printers. */
export interface TicketLine {
  text: string
  center?: boolean
  bold?: boolean
  big?: boolean
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    for (let piece = word; piece.length > 0; piece = piece.slice(width)) {
      const chunk = piece.slice(0, width)
      if (!current) {
        current = chunk
      } else if (current.length + 1 + chunk.length <= width) {
        current += ` ${chunk}`
      } else {
        lines.push(current)
        current = chunk
      }
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines
}

/** "Total ........ Q78.40" fitted to the width. */
function pair(left: string, right: string, width: number): string {
  const room = width - right.length - 1
  const label = left.length > room ? left.slice(0, room) : left
  return label + ' '.repeat(width - label.length - right.length) + right
}

/** The ticket of a sale: the company, the lines, totals and payments. It is not a tax invoice. */
export function ticketLines(sale: LocalSale, catalog: Catalog, paper: PaperWidth, reprint = false): TicketLine[] {
  const width = COLUMNS[paper]
  const company = catalog.company
  const money = (value: number) => formatMoney(value, company.currency, company.locale)
  const out: TicketLine[] = []
  const rule = () => out.push({ text: '-'.repeat(width) })

  out.push({ text: company.name, center: true, bold: true, big: paper === 80 })
  if (company.legalName && company.legalName !== company.name) {
    wrap(company.legalName, width).forEach(text => out.push({ text, center: true }))
  }
  if (company.taxId) {
    out.push({ text: `${company.taxIdLabel}: ${company.taxId}`, center: true })
  }
  if (company.address) {
    wrap(company.address, width).forEach(text => out.push({ text, center: true }))
  }
  if (company.phone) {
    out.push({ text: `Tel. ${company.phone}`, center: true })
  }
  rule()
  out.push({ text: `${company.saleDocumentName} ${sale.number}`, bold: true })
  out.push({ text: formatDateTime(sale.soldAt) })
  out.push({ text: `Atendió: ${sale.sellerName ?? catalog.seller.name}` })
  if (sale.account) {
    out.push({ text: `Cuenta: ${sale.account}` })
  }
  const customer = sale.customer ?? catalog.finalConsumer
  wrap(`Cliente: ${customer.name}`, width).forEach(text => out.push({ text }))
  if (customer.taxId) {
    out.push({ text: `${company.taxIdLabel}: ${customer.taxId}` })
  }
  rule()
  for (const line of sale.lines) {
    wrap(line.name, width).forEach(text => out.push({ text }))
    if (line.options?.length) {
      wrap(`  ${optionsText(line.options)}`, width).forEach(text => out.push({ text }))
    }
    const detail = `  ${formatQuantity(line.quantity)} x ${money(line.unitPrice)}${line.discountPercent ? ` -${line.discountPercent}%` : ''}`
    out.push({ text: pair(detail, money(lineAmount(line)), width) })
  }
  rule()
  const t = sale.totals
  if (t.discount > 0) {
    out.push({ text: pair('Subtotal', money(t.subtotal), width) })
    out.push({ text: pair('Descuento', `-${money(t.discount)}`, width) })
  }
  if (t.tax > 0 && !catalog.tax.pricesIncludeTax) {
    out.push({ text: pair('Neto', money(t.net), width) })
    out.push({ text: pair(catalog.tax.label, money(t.tax), width) })
  }
  out.push({ text: pair('TOTAL', money(t.total), width), bold: true, big: paper === 80 })
  if (t.tax > 0 && catalog.tax.pricesIncludeTax) {
    out.push({ text: pair(`${catalog.tax.label} incluido`, money(t.tax), width) })
  }
  for (const payment of sale.payments) {
    const label = PAYMENT_METHODS[payment.method].label + (payment.reference ? ` ${payment.reference}` : '')
    out.push({ text: pair(label, money(payment.received ?? payment.amount), width) })
  }
  if (sale.change > 0) {
    out.push({ text: pair('Vuelto', money(sale.change), width) })
  }
  rule()
  if (reprint) {
    out.push({ text: 'REIMPRESIÓN', center: true, bold: true })
  }
  out.push({ text: 'Gracias por su compra', center: true })
  return out
}

/** The same ticket as plain text, for the browser's print (fonts there are not the printer's). */
export function ticketText(lines: TicketLine[], paper: PaperWidth): string {
  const width = COLUMNS[paper]
  return lines.map((line) => {
    if (!line.center || line.text.length >= width) {
      return line.text
    }
    return ' '.repeat(Math.floor((width - line.text.length) / 2)) + line.text
  }).join('\n')
}

// ---- ESC/POS

const ESC = 0x1B
const GS = 0x1D

/** Code page 850 (ESC t 2), which cheap thermal printers have: the Spanish letters. */
const CP850: Record<string, number> = {
  'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5, 'ü': 0x81, 'Ü': 0x9A,
  'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9, '¿': 0xA8, '¡': 0xAD, '°': 0xF8
}

function encode(text: string): number[] {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code < 0x80) {
      bytes.push(code)
    } else if (CP850[char] !== undefined) {
      bytes.push(CP850[char])
    } else {
      // Anything else without its accent, or a ?
      const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
      bytes.push(base.length === 1 && base.charCodeAt(0) < 0x80 ? base.charCodeAt(0) : 0x3F)
    }
  }
  return bytes
}

/** The bytes an ESC/POS printer understands: text, alignment, bold, double size, feed and cut. */
export function escPos(lines: TicketLine[]): Uint8Array {
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 2]
  for (const line of lines) {
    bytes.push(ESC, 0x61, line.center ? 1 : 0)
    bytes.push(ESC, 0x45, line.bold ? 1 : 0)
    bytes.push(GS, 0x21, line.big ? 0x11 : 0)
    bytes.push(...encode(line.text), 0x0A)
  }
  bytes.push(ESC, 0x61, 0, GS, 0x21, 0, ESC, 0x64, 4, GS, 0x56, 0x42, 0)
  return new Uint8Array(bytes)
}
