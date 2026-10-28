import type {
  AppContext, CartLine, CartOption, Catalog, ClaimResult, Customer, LocalSale, LocalShift, OpenAccount, OptionGroup, Payment,
  Product, Setup, ShiftClosing, Station, StockAlert, SyncResult, Terminal
} from '~/types/pos'

const DEVICE_KEY = 'falco_pos_device_id'
/** Tickets Falco already has are kept this long on the device, for the cortes and reprints. */
const KEEP_DAYS = 30
const SALES_PER_SYNC = 100
const SYNC_EVERY_MS = 60_000

interface State {
  ready: boolean
  setup: Setup | null
  catalog: Catalog | null
  /** The open shift, if any. */
  shift: LocalShift | null
  /** Every ticket kept on the device, newest first. */
  sales: LocalSale[]
  shifts: LocalShift[]
  accounts: OpenAccount[]
  cart: CartLine[]
  customer: Customer | null
  /** The station whose open account is being served; null: a direct sale. */
  stationId: string | null
  online: boolean
  syncing: boolean
  lastSyncAt: string | null
  syncError: string | null
  /** Falco rejected the session: the seller has to sign in again to send what is pending. */
  needsLogin: boolean
  /** False once Falco says the terminal is no longer assigned to this seller (FA-012). */
  canSell: boolean
  /** The bell: stock of the terminal's warehouse that needs attention, as Falco last said. */
  alerts: StockAlert[]
}

const state = reactive<State>({
  ready: false,
  setup: null,
  catalog: null,
  shift: null,
  sales: [],
  shifts: [],
  accounts: [],
  cart: [],
  customer: null,
  stationId: null,
  online: true,
  syncing: false,
  lastSyncAt: null,
  syncError: null,
  needsLogin: false,
  canSell: true,
  alerts: []
})

let loading: Promise<void> | null = null
let timer: ReturnType<typeof setInterval> | null = null

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function pad(value: number, size: number) {
  return String(value).padStart(size, '0')
}

const newestFirst = <T extends { soldAt?: string, openedAt?: string }>(a: T, b: T) =>
  (b.soldAt ?? b.openedAt ?? '').localeCompare(a.soldAt ?? a.openedAt ?? '')

/**
 * The POS on this device: its terminal and catalog, the shift, the cart and the open accounts, and
 * the queue of what Falco does not have yet. Everything is kept in IndexedDB, so the POS sells
 * without internet and sends it all when it comes back.
 */
export function usePos() {
  const api = useApi()
  const auth = useAuth()

  // ---- Loading

  function load(): Promise<void> {
    loading ??= (async () => {
      state.setup = (await db.get<Setup>('kv', 'setup')) ?? null
      state.catalog = (await db.get<Catalog>('kv', 'catalog')) ?? null
      state.lastSyncAt = (await db.get<string>('kv', 'lastSyncAt')) ?? null
      state.canSell = (await db.get<boolean>('kv', 'canSell')) ?? true
      state.alerts = (await db.get<StockAlert[]>('kv', 'alerts')) ?? []
      await prune()
      state.sales = (await db.all<LocalSale>('sales')).sort(newestFirst)
      state.shifts = (await db.all<LocalShift>('shifts')).sort(newestFirst)
      state.shift = state.shifts.find(s => !s.closedAt) ?? null
      state.accounts = await db.all<OpenAccount>('accounts')
      const cart = await db.get<{ lines: CartLine[], customer: Customer | null }>('kv', 'cart')
      state.cart = cart?.lines ?? []
      state.customer = cart?.customer ?? null
      state.online = navigator.onLine
      window.addEventListener('online', () => {
        state.online = true
        sync()
      })
      window.addEventListener('offline', () => {
        state.online = false
      })
      timer ??= setInterval(() => sync(), SYNC_EVERY_MS)
      state.ready = true
    })()
    return loading
  }

  /** Forgets tickets and closed shifts Falco has had for a while. */
  async function prune() {
    const limit = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()
    for (const shift of await db.all<LocalShift>('shifts')) {
      if (shift.closedAt && shift.closedAt < limit && shift.sync === 'synced') {
        const sales = await db.byShift<LocalSale>(shift.clientId)
        if (sales.every(s => s.sync === 'synced')) {
          for (const sale of sales) {
            await db.delete('sales', sale.clientId)
          }
          await db.delete('shifts', shift.clientId)
        }
      }
    }
  }

  // ---- What is pending

  const pendingSales = computed(() => state.sales.filter(s => s.sync !== 'synced'))
  const pendingShifts = computed(() => state.shifts.filter(s => s.sync !== 'synced'))
  const pending = computed(() => pendingSales.value.length + pendingShifts.value.length)
  const failed = computed(() => [...state.sales, ...state.shifts].filter(item => item.sync === 'error'))

  // ---- Terminal and catalog

  /**
   * Checks the signed-in person may sell in the POS. Returns why not, or null.
   */
  async function checkAccess(): Promise<string | null> {
    const context = await api<AppContext>('/app/context')
    if (!context.modules.some(m => m.code === 'POS')) {
      return 'El punto de venta no está activo para tu empresa. Pídele a Falco que lo active.'
    }
    if (!context.user.admin && !context.user.permissions.includes('pos.sell')) {
      return 'Tu usuario no tiene permiso para vender en el POS. Pídeselo al administrador.'
    }
    return null
  }

  /** After signing in: another company's data never stays on the device. */
  async function adoptTenant(tenantId: string): Promise<string | null> {
    await load()
    if (state.setup && state.setup.tenantId !== tenantId) {
      if (pending.value > 0 || state.shift) {
        return 'Este dispositivo tiene un turno abierto o ventas sin enviar de otra empresa. Entra con esa empresa para terminarlas.'
      }
      await db.clear()
      Object.assign(state, { setup: null, catalog: null, shift: null, sales: [], shifts: [], accounts: [], cart: [], customer: null, stationId: null })
    }
    return null
  }

  const terminals = () => api<Terminal[]>('/app/pos/terminals', { query: { active: true } })

  /** Takes the terminal for this device and downloads what it sells. */
  async function claim(terminal: Terminal, deviceName: string): Promise<ClaimResult> {
    if (state.setup && state.setup.terminal.id !== terminal.id && (state.shift || pending.value > 0)) {
      throw new Error('Cierra el turno y espera a que se envíen las ventas antes de cambiar de punto de venta.')
    }
    const result = await api<ClaimResult>(`/app/pos/terminals/${terminal.id}/claim`, { method: 'POST', body: { deviceId: deviceId(), deviceName } })
    const same = state.setup?.terminal.id === terminal.id
    state.setup = {
      tenantId: auth.session.value!.tenantId!,
      terminal: result.terminal,
      deviceName,
      lastNumber: Math.max(result.lastNumber, same ? state.setup!.lastNumber : 0),
      lastShiftNumber: Math.max(result.lastShiftNumber, same ? state.setup!.lastShiftNumber : 0)
    }
    await db.put('kv', state.setup, 'setup')
    if (!same) {
      for (const account of state.accounts) {
        await db.delete('accounts', account.stationId)
      }
      state.accounts = []
      state.stationId = null
    }
    await downloadCatalog()
    return result
  }

  /** Whether the signed-in seller may sell with the terminal, as Falco last said. */
  async function setCanSell(value: boolean) {
    state.canSell = value
    await db.put('kv', value, 'canSell')
  }

  async function downloadCatalog() {
    if (!state.setup) {
      return
    }
    let catalog: Catalog
    try {
      catalog = await api<Catalog>(`/app/pos/terminals/${state.setup.terminal.id}/catalog`)
    } catch (error) {
      if (statusOf(error) === 403) {
        await setCanSell(false)
      }
      throw error
    }
    await setCanSell(true)
    refreshAlerts()
    state.catalog = catalog
    state.setup.terminal = catalog.terminal
    await db.put('kv', catalog, 'catalog')
    await db.put('kv', state.setup, 'setup')
  }

  const currency = computed(() => state.catalog?.company.currency ?? 'GTQ')
  const money = (value: number) => formatMoney(value, currency.value, state.catalog?.company.locale)

  /**
   * Stock as Falco had it, less what the device sold since the catalog was downloaded: a product takes
   * itself, an instant one its recipe, and the options change it as Falco does (see takesPerUnit).
   */
  const soldSinceCatalog = computed(() => {
    const since = state.catalog?.generatedAt ?? ''
    const products = new Map((state.catalog?.products ?? []).map(p => [p.id, p]))
    const effects = new Map((state.catalog?.optionGroups ?? []).flatMap(g => g.options).map(o => [o.id, o.effects]))
    const sold: Record<string, number> = {}
    for (const sale of state.sales) {
      if (sale.soldAt > since) {
        for (const line of sale.lines) {
          takesPerUnit(line, products.get(line.productId), effects).forEach((quantity, productId) => {
            sold[productId] = (sold[productId] ?? 0) + quantity * line.quantity
          })
        }
      }
    }
    return sold
  })
  const stockOf = (product: Product) => round(product.stock - (soldSinceCatalog.value[product.id] ?? 0), 4)

  // ---- Shift

  async function openShift(openingFloat: number) {
    const setup = state.setup!
    const session = auth.session.value!
    setup.lastShiftNumber += 1
    await db.put('kv', setup, 'setup')
    const shift: LocalShift = {
      clientId: crypto.randomUUID(),
      number: `${setup.terminal.code}-T${pad(setup.lastShiftNumber, 4)}`,
      userId: session.userId,
      sellerName: state.catalog?.seller.name ?? session.name,
      openedAt: new Date().toISOString(),
      openingFloat: round(openingFloat),
      closedAt: null,
      closing: null,
      sync: 'pending',
      error: null
    }
    await db.put('shifts', shift)
    state.shifts.unshift(shift)
    state.shift = shift
    sync()
  }

  const salesOf = (shiftClientId: string) => state.sales.filter(s => s.shiftClientId === shiftClientId)

  /** The corte de caja of a shift: what was sold by method and the cash that should be in the drawer. */
  function closingOf(shift: LocalShift, countedCash = 0, notes: string | null = null): ShiftClosing {
    const sales = salesOf(shift.clientId)
    const by = (method: string) => round(sales.flatMap(s => s.payments).filter(p => p.method === method).reduce((sum, p) => sum + p.amount, 0))
    const cashTotal = by('CASH')
    const expectedCash = round(shift.openingFloat + cashTotal)
    return {
      salesCount: sales.length,
      salesTotal: round(sales.reduce((sum, s) => sum + s.totals.total, 0)),
      cashTotal,
      transferTotal: by('TRANSFER'),
      cardTotal: by('CARD'),
      expectedCash,
      countedCash: round(countedCash),
      difference: round(countedCash - expectedCash),
      notes
    }
  }

  async function closeShift(countedCash: number, notes: string | null) {
    const shift = state.shift!
    shift.closing = closingOf(shift, countedCash, notes?.trim() || null)
    shift.closedAt = new Date().toISOString()
    shift.sync = 'pending'
    shift.error = null
    await db.put('shifts', shift)
    state.shift = null
    sync()
    return shift
  }

  // ---- Cart and open accounts

  const station = computed<Station | null>(() => state.setup?.terminal.stations.find(s => s.id === state.stationId) ?? null)
  const cartTotals = computed(() => totals(state.cart, state.catalog?.tax.rate ?? 0, state.catalog?.tax.pricesIncludeTax ?? false))
  const cartCount = computed(() => state.cart.reduce((sum, l) => sum + l.quantity, 0))

  async function persistCart() {
    if (state.stationId) {
      const existing = state.accounts.find(a => a.stationId === state.stationId)
      if (!state.cart.length) {
        state.accounts = state.accounts.filter(a => a.stationId !== state.stationId)
        await db.delete('accounts', state.stationId)
        return
      }
      const now = new Date().toISOString()
      const account: OpenAccount = {
        stationId: state.stationId,
        name: station.value?.name ?? existing?.name ?? '',
        lines: state.cart,
        customer: state.customer,
        openedAt: existing?.openedAt ?? now,
        updatedAt: now
      }
      state.accounts = [...state.accounts.filter(a => a.stationId !== state.stationId), account]
      await db.put('accounts', account)
    } else {
      await db.put('kv', { lines: state.cart, customer: state.customer }, 'cart')
    }
  }

  /** The groups of options a product asks for, in order. */
  const optionGroupsOf = (product: Product): OptionGroup[] => (product.optionGroups ?? [])
    .map(id => state.catalog?.optionGroups?.find(g => g.id === id))
    .filter((g): g is OptionGroup => !!g && g.options.length > 0)

  /** The same product with the same options adds to its line; with other options it is another line. */
  function addProduct(product: Product, quantity = 1, options: CartOption[] = []) {
    const key = [product.id, ...options.map(o => `${o.optionId}x${o.quantity}`).sort()].join('|')
    const line = state.cart.find(l => lineKey(l) === key)
    if (line) {
      line.quantity = round(line.quantity + quantity, 4)
    } else {
      const extra = options.reduce((sum, o) => sum + o.price * o.quantity, 0)
      state.cart.push({
        key, productId: product.id, code: product.code, name: product.name, unitSymbol: product.unitSymbol,
        quantity, unitPrice: round(product.price + extra, 6), discountPercent: 0, options
      })
    }
    persistCart()
  }

  function setQuantity(key: string, quantity: number) {
    const line = state.cart.find(l => lineKey(l) === key)
    if (!line) {
      return
    }
    if (quantity <= 0) {
      state.cart = state.cart.filter(l => lineKey(l) !== key)
    } else {
      line.quantity = round(quantity, 4)
    }
    persistCart()
  }

  function setDiscount(key: string, percent: number) {
    const line = state.cart.find(l => lineKey(l) === key)
    if (line && state.catalog?.seller.canDiscount) {
      line.discountPercent = Math.min(100, Math.max(0, round(percent)))
      persistCart()
    }
  }

  function setCustomer(customer: Customer | null) {
    state.customer = customer
    persistCart()
  }

  function clearCart() {
    state.cart = []
    state.customer = null
    persistCart()
  }

  /** Serves a station: its open account becomes the cart (null: back to direct sales). */
  async function selectStation(stationId: string | null) {
    if (stationId === state.stationId) {
      return
    }
    if (!state.stationId) {
      await db.put('kv', { lines: state.cart, customer: state.customer }, 'cart')
    }
    state.stationId = stationId
    if (stationId) {
      const account = state.accounts.find(a => a.stationId === stationId)
      state.cart = account ? [...account.lines] : []
      state.customer = account?.customer ?? null
    } else {
      const cart = await db.get<{ lines: CartLine[], customer: Customer | null }>('kv', 'cart')
      state.cart = cart?.lines ?? []
      state.customer = cart?.customer ?? null
    }
  }

  const searchCustomers = (q: string) => api<Customer[]>('/app/pos/customers', { query: { q } })

  // ---- Charging

  /** Records the ticket on the device (it is sent to Falco right away, or when there is internet). */
  async function charge(payments: Payment[], change: number): Promise<LocalSale> {
    const setup = state.setup!
    setup.lastNumber += 1
    await db.put('kv', setup, 'setup')
    const sale: LocalSale = {
      clientId: crypto.randomUUID(),
      shiftClientId: state.shift!.clientId,
      sellerId: state.catalog?.seller.id ?? auth.session.value?.userId ?? null,
      sellerName: state.catalog?.seller.name ?? auth.session.value?.name ?? null,
      number: `${setup.terminal.code}-${pad(setup.lastNumber, 5)}`,
      soldAt: new Date().toISOString(),
      customer: state.customer,
      lines: state.cart.map(l => ({ ...l })),
      payments: payments.map(p => ({ ...p, amount: round(p.amount), received: p.received === undefined ? undefined : round(p.received) })),
      totals: cartTotals.value,
      change: round(change),
      account: station.value?.name ?? null,
      notes: null,
      sync: 'pending',
      error: null,
      erpNumber: null
    }
    await db.put('sales', sale)
    state.sales.unshift(sale)
    // The account of the station is closed with it
    clearCart()
    await selectStation(null)
    sync()
    return sale
  }

  // ---- Sync

  /** What the bell shows: asked for after each send, kept for when there is no internet. */
  async function refreshAlerts() {
    if (!state.setup || !auth.signedIn.value || !navigator.onLine || !state.canSell) {
      return
    }
    try {
      state.alerts = await api<StockAlert[]>(`/app/pos/terminals/${state.setup.terminal.id}/notifications`)
      await db.put('kv', toRaw(state.alerts), 'alerts')
    } catch {
      // The bell keeps what it had
    }
  }

  /** Sends what Falco does not have: shifts, tickets, closings. Each one is recorded once. */
  async function sync(): Promise<void> {
    if (state.syncing || !state.setup || !auth.signedIn.value || !navigator.onLine) {
      return
    }
    if (!pending.value) {
      await refreshAlerts()
      return
    }
    state.syncing = true
    state.syncError = null
    try {
      let sales = pendingSales.value.slice().reverse()
      let first = true
      while (first || sales.length) {
        first = false
        const batch = sales.slice(0, SALES_PER_SYNC)
        sales = sales.slice(SALES_PER_SYNC)
        const shifts = pendingShifts.value.slice(0, 50)
        const result = await api<SyncResult>('/app/pos/sync', {
          method: 'POST',
          body: {
            terminalId: state.setup.terminal.id,
            shifts: shifts.map(s => ({
              clientId: s.clientId, userId: s.userId, number: s.number, openedAt: s.openedAt, openingFloat: s.openingFloat, closedAt: s.closedAt,
              ...(s.closing ?? {})
            })),
            sales: batch.map(s => ({
              clientId: s.clientId, shiftClientId: s.shiftClientId, sellerId: s.sellerId ?? null, number: s.number, soldAt: s.soldAt,
              customerId: s.customer?.id ?? null,
              lines: s.lines.map(l => ({
                productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: l.discountPercent || null,
                options: l.options?.map(o => ({ optionId: o.optionId, quantity: o.quantity, price: o.price }))
              })),
              payments: s.payments.filter(p => p.amount > 0).map(p => ({ method: p.method, amount: p.amount, reference: p.reference || null })),
              account: s.account, notes: s.notes
            }))
          }
        })
        await setCanSell(result.canSell)
        for (const item of result.shifts) {
          const shift = state.shifts.find(s => s.clientId === item.clientId)
          if (shift) {
            shift.sync = item.ok ? 'synced' : 'error'
            shift.error = item.error
            await db.put('shifts', shift)
          }
        }
        for (const item of result.sales) {
          const sale = state.sales.find(s => s.clientId === item.clientId)
          if (sale) {
            sale.sync = item.ok ? 'synced' : 'error'
            sale.error = item.error
            sale.erpNumber = item.number
            await db.put('sales', sale)
          }
        }
      }
      state.lastSyncAt = new Date().toISOString()
      state.needsLogin = false
      await db.put('kv', state.lastSyncAt, 'lastSyncAt')
      await refreshAlerts()
    } catch (error) {
      const status = statusOf(error)
      if (status === 401) {
        state.needsLogin = true
      }
      state.syncError = errorMessage(error)
    } finally {
      state.syncing = false
    }
  }

  /**
   * Another seller takes over the device, with the shift still open (FA-012): the session closes
   * and the next one signs in. What is pending stays and is sent with the new session.
   */
  async function switchSeller() {
    await auth.logout()
    state.needsLogin = false
    await navigateTo('/login')
  }

  /** Sales of the shift by seller, for the corte. */
  function sellersOf(shiftClientId: string) {
    const by = new Map<string, { name: string, count: number, total: number }>()
    for (const sale of salesOf(shiftClientId)) {
      const name = sale.sellerName ?? '—'
      const entry = by.get(name) ?? { name, count: 0, total: 0 }
      entry.count += 1
      entry.total = round(entry.total + sale.totals.total)
      by.set(name, entry)
    }
    return [...by.values()]
  }

  return {
    switchSeller, sellersOf, refreshAlerts,
    state, pending, pendingSales, failed, load, checkAccess, adoptTenant, terminals, claim, downloadCatalog,
    currency, money, stockOf, openShift, closeShift, closingOf, salesOf,
    station, cartTotals, cartCount, optionGroupsOf, addProduct, setQuantity, setDiscount, setCustomer, clearCart, selectStation, searchCustomers,
    charge, sync
  }
}
