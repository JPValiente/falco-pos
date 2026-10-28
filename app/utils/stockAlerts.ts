import type { StockAlert } from '~/types/pos'

/** How the bell tells each stock alert (the same words as in Falco). */
export function stockAlertText(alert: StockAlert): { title: string, description: string, icon: string, color: 'error' | 'warning' } {
  const qty = `${formatQuantity(Number(alert.stock))} ${alert.unit}`.trim()
  if (alert.kind === 'NEGATIVE') {
    return { title: `${alert.name} en negativo`, description: `${alert.warehouse}: ${qty}. Se vendió sin existencia; avísale al administrador.`, icon: 'i-lucide-circle-minus', color: 'error' }
  }
  if (alert.kind === 'OUT') {
    return { title: `Se acabó ${alert.name}`, description: `${alert.warehouse}: sin existencia. Lo usan productos que se preparan al venderlos.`, icon: 'i-lucide-package-x', color: 'error' }
  }
  return { title: `Queda poco ${alert.name}`, description: `${qty} en todas las bodegas; el mínimo es ${formatQuantity(Number(alert.minStock))} ${alert.unit}.`, icon: 'i-lucide-trending-down', color: 'warning' }
}
