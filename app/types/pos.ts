/** What falco-core answers (PosDtos) and what the device keeps (IndexedDB, see utils/db.ts). */

export interface NamedRef {
  id: string
  name: string
}

// ---- Session (AuthController)

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tenantSelection: TenantSelection | null
}

export interface TenantOption {
  tenantId: string
  name: string
  role: string
  last: boolean
}

export interface TenantSelection {
  selectionToken: string
  tenants: TenantOption[]
}

export interface Session {
  userId: string
  name: string
  roles: string[]
  tenantId: string | null
  /** Epoch seconds. */
  expiresAt: number
}

/** The part of GET /app/context the POS needs. */
export interface AppContext {
  tenant: { id: string, name: string, currency: string, locale: string }
  user: { id: string, fullName: string, admin: boolean, permissions: string[] }
  modules: { code: string }[]
}

// ---- Terminals

export interface Station {
  id: string
  zone: string | null
  name: string
  sortOrder: number
  active: boolean
}

export interface Terminal {
  id: string
  code: string
  name: string
  warehouse: NamedRef | null
  bankAccount: NamedRef | null
  usesAccounts: boolean
  active: boolean
  deviceName: string | null
  lastSyncAt: string | null
  stations: Station[]
}

export interface ClaimResult {
  terminal: Terminal
  lastNumber: number
  lastShiftNumber: number
  previousDevice: string | null
}

export interface Catalog {
  company: {
    name: string
    legalName: string | null
    taxId: string | null
    taxIdLabel: string
    address: string | null
    phone: string | null
    currency: string
    locale: string
    timezone: string
    saleDocumentName: string
  }
  tax: { regime: string, label: string, rate: number, pricesIncludeTax: boolean }
  terminal: Terminal
  seller: { id: string, name: string, canDiscount: boolean, canManage: boolean }
  categories: NamedRef[]
  products: Product[]
  finalConsumer: Customer
  generatedAt: string
}

export interface Product {
  id: string
  code: string
  name: string
  categoryId: string | null
  unitSymbol: string | null
  price: number
  /** In the terminal's warehouse when the catalog was downloaded; may be below zero. */
  stock: number
  /** Prepared when sold (a cup of coffee): no stock of its own, its supplies leave instead. */
  instant: boolean
  /** What one unit of an instant product takes; missing in catalogs downloaded before it existed. */
  supplies?: { productId: string, quantity: number }[]
}

/** NEGATIVE: below zero in the warehouse; OUT: a supply ran out; LOW: under the minimum (all warehouses). */
export interface StockAlert {
  key: string
  kind: 'NEGATIVE' | 'OUT' | 'LOW'
  productId: string
  code: string
  name: string
  unit: string
  warehouse: string | null
  stock: number
  minStock: number | null
}

export interface Customer {
  id: string
  code: string | null
  name: string
  taxId: string | null
}

// ---- Selling

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD'

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string, icon: string }> = {
  CASH: { label: 'Efectivo', icon: 'i-lucide-banknote' },
  TRANSFER: { label: 'Transferencia', icon: 'i-lucide-landmark' },
  CARD: { label: 'Tarjeta', icon: 'i-lucide-credit-card' }
}

export interface CartLine {
  productId: string
  code: string
  name: string
  unitSymbol: string | null
  quantity: number
  unitPrice: number
  /** 0 to 100; only who may discount sets it. */
  discountPercent: number
}

export interface Totals {
  subtotal: number
  discount: number
  net: number
  tax: number
  total: number
}

/** {@code amount}: what is applied to the sale; for cash, {@code received} minus the change. */
export interface Payment {
  method: PaymentMethod
  amount: number
  received?: number
  reference?: string
}

export type SyncState = 'pending' | 'synced' | 'error'

/** A ticket as the device keeps it until (and after) Falco has it. */
export interface LocalSale {
  clientId: string
  shiftClientId: string
  /** Who sold it: the seller may change during the shift (FA-012). */
  sellerId: string | null
  sellerName: string | null
  /** The POS's own number (POS1-00001). */
  number: string
  soldAt: string
  customer: Customer | null
  lines: CartLine[]
  payments: Payment[]
  totals: Totals
  change: number
  /** The station or open account it was charged on. */
  account: string | null
  notes: string | null
  sync: SyncState
  error: string | null
  /** The ERP's number once recorded (V-000123). */
  erpNumber: string | null
}

export interface LocalShift {
  clientId: string
  number: string
  userId: string
  sellerName: string
  openedAt: string
  openingFloat: number
  closedAt: string | null
  /** Set when closed: the corte de caja. */
  closing: ShiftClosing | null
  sync: SyncState
  error: string | null
}

export interface ShiftClosing {
  salesCount: number
  salesTotal: number
  cashTotal: number
  transferTotal: number
  cardTotal: number
  expectedCash: number
  countedCash: number
  difference: number
  notes: string | null
}

/** An open account of a station (FA-006/007): what was ordered, charged later. Only on this device. */
export interface OpenAccount {
  stationId: string
  name: string
  lines: CartLine[]
  customer: Customer | null
  openedAt: string
  updatedAt: string
}

// ---- Sync (POST /pos/sync)

export interface ItemResult {
  clientId: string
  ok: boolean
  id: string | null
  number: string | null
  error: string | null
}

export interface SyncResult {
  shifts: ItemResult[]
  sales: ItemResult[]
  serverTime: string
  /** Whether the signed-in seller may still sell with the terminal (it may have been unassigned). */
  canSell: boolean
}

/** A shift as Falco has it (GET /pos/shifts). */
export interface ServerShift {
  id: string
  number: string
  terminal: NamedRef | null
  seller: NamedRef | null
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt: string | null
  openingFloat: number
  salesCount: number | null
  salesTotal: number | null
  expectedCash: number | null
  countedCash: number | null
  difference: number | null
  syncedSales: number
  syncedTotal: number
}

/** The device's setup: which company and terminal it sells for. */
export interface Setup {
  tenantId: string
  terminal: Terminal
  deviceName: string
  lastNumber: number
  lastShiftNumber: number
}
