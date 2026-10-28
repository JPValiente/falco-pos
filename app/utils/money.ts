import type { CartLine, Totals } from '~/types/pos'

/** Rounds half up to the given decimals, as falco-core does (BigDecimal HALF_UP), for amounts ≥ 0. */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor
}

/** SaleService.lineAmount. */
export function lineAmount(line: Pick<CartLine, 'quantity' | 'unitPrice' | 'discountPercent'>): number {
  const gross = line.quantity * line.unitPrice
  const discount = round(gross * (line.discountPercent || 0) / 100, 6)
  return round(gross - discount)
}

/**
 * SaleService.totals: with prices including the tax the total is the sum of the lines and the tax
 * is taken out of it; without it, the tax is added on top; with no tax, nothing is added.
 */
export function totals(lines: CartLine[], rate: number, pricesIncludeTax: boolean): Totals {
  const subtotal = round(lines.reduce((sum, l) => sum + round(l.quantity * l.unitPrice), 0))
  const sum = round(lines.reduce((total, l) => total + lineAmount(l), 0))
  let net = sum
  let tax = 0
  let total = sum
  if (rate > 0 && pricesIncludeTax) {
    net = round(sum / (1 + rate))
    tax = round(total - net)
  } else if (rate > 0) {
    tax = round(sum * rate)
    total = round(net + tax)
  }
  return { subtotal, discount: round(subtotal - sum), net, tax, total }
}

export function formatMoney(value: number, currency: string, locale = 'es-GT'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('es-GT', { maximumFractionDigits: 4 }).format(value)
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-GT', { timeStyle: 'short' }).format(new Date(iso))
}
