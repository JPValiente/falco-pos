import type { CartLine, CartOption, OptionEffect, Product } from '~/types/pos'

/** A cart line: its product and options (older carts kept only the product). */
export const lineKey = (line: CartLine) => line.key ?? line.productId

/** "Almendra · Shot extra ×2". */
export const optionsText = (options?: CartOption[]) =>
  (options ?? []).map(o => o.quantity > 1 ? `${o.name} ×${o.quantity}` : o.name).join(' · ')

/**
 * What one unit of a line takes from the warehouse, as Falco computes it: the product itself, or an
 * instant product's recipe; then its options (ADD once per time chosen; REPLACE and REMOVE once). The
 * supplies also take their expected waste (`waste`: % by supply, FA-015); the product itself does not.
 */
export function takesPerUnit(line: Pick<CartLine, 'productId' | 'options'>, product: Product | undefined,
  effects: Map<string, OptionEffect[]>, waste: Record<string, number> = {}): Map<string, number> {
  const takes = new Map<string, number>()
  const add = (productId: string, quantity: number) => takes.set(productId, (takes.get(productId) ?? 0) + quantity)
  if (product?.instant) {
    product.supplies?.forEach(s => add(s.productId, s.quantity))
  }
  for (const option of line.options ?? []) {
    for (const e of effects.get(option.optionId) ?? []) {
      if (e.kind === 'ADD') {
        add(e.product.id, (e.quantity ?? 0) * option.quantity)
      } else if (e.kind === 'REPLACE') {
        const replaced = e.replaces ? takes.get(e.replaces.id) : undefined
        if (e.replaces) {
          takes.delete(e.replaces.id)
        }
        const quantity = e.quantity ?? replaced
        if (quantity !== undefined) {
          add(e.product.id, quantity)
        }
      } else {
        takes.delete(e.product.id)
      }
    }
  }
  takes.forEach((quantity, productId) => {
    if (waste[productId]) {
      takes.set(productId, quantity * (1 + waste[productId] / 100))
    }
  })
  if (!product?.instant) {
    add(line.productId, 1)
  }
  return takes
}
