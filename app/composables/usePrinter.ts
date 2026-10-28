import type { LocalSale } from '~/types/pos'
import type { PaperWidth } from '~/utils/ticket'

export type PrintMode = 'bluetooth' | 'browser'

export interface PrinterSettings {
  /** Print the ticket after charging (each sale can still skip it). */
  enabled: boolean
  paper: PaperWidth
  mode: PrintMode
}

const SETTINGS_KEY = 'falco_pos_printer'

/** GATT services of the common Bluetooth thermal printers (they do not announce a standard one). */
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb'
]
const CHUNK = 100

function readSettings(): PrinterSettings {
  const defaults: PrinterSettings = { enabled: false, paper: 58, mode: 'bluetooth' }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

const settings = reactive<PrinterSettings>(readSettings())
const connection = reactive<{ device: BluetoothDevice | null, connecting: boolean }>({ device: null, connecting: false })
let characteristic: BluetoothRemoteGATTCharacteristic | null = null
/** What the browser prints (app.vue shows it only on paper). */
const browserTicket = ref('')

/**
 * The ticket printer of this device (FA-010). A Bluetooth thermal printer (ESC/POS) where the browser
 * can reach it (Chrome on Android or a computer); elsewhere, such as an iPhone, the browser's print
 * dialog (AirPrint or the printer's app). The choice is kept on the device.
 */
export function usePrinter() {
  const pos = usePos()
  const bluetoothAvailable = computed(() => import.meta.client && !!navigator.bluetooth)

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // Private mode: the settings last while the app is open
    }
  }

  async function attach(device: BluetoothDevice) {
    const server = await device.gatt!.connect()
    for (const service of await server.getPrimaryServices()) {
      for (const candidate of await service.getCharacteristics()) {
        if (candidate.properties.write || candidate.properties.writeWithoutResponse) {
          characteristic = candidate
          connection.device = device
          return
        }
      }
    }
    server.disconnect()
    throw new Error('La impresora no acepta impresión por Bluetooth')
  }

  /** Asks the browser for the printer (the person picks it in the list). */
  async function connect() {
    if (!navigator.bluetooth) {
      throw new Error('Este navegador no tiene Bluetooth. Usa Chrome en Android o imprime con el navegador.')
    }
    connection.connecting = true
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES })
      await attach(device)
    } finally {
      connection.connecting = false
    }
  }

  /** The printer used before, without asking, where the browser allows it. */
  async function reconnect(): Promise<boolean> {
    if (connection.device?.gatt?.connected && characteristic) {
      return true
    }
    const device = connection.device ?? (await navigator.bluetooth?.getDevices?.())?.[0]
    if (!device) {
      return false
    }
    try {
      await attach(device)
      return true
    } catch {
      return false
    }
  }

  function disconnect() {
    connection.device?.gatt?.disconnect()
    connection.device = null
    characteristic = null
  }

  async function send(bytes: Uint8Array) {
    const target = characteristic!
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const chunk = bytes.slice(i, i + CHUNK)
      if (target.properties.writeWithoutResponse && target.writeValueWithoutResponse) {
        await target.writeValueWithoutResponse(chunk)
      } else {
        await target.writeValue(chunk)
      }
    }
  }

  async function print(sale: LocalSale, reprint = false) {
    const catalog = pos.state.catalog!
    const lines = ticketLines(sale, catalog, settings.paper, reprint)
    if (settings.mode === 'bluetooth' && bluetoothAvailable.value) {
      if (!await reconnect()) {
        throw new Error('La impresora no está conectada. Conéctala en Ajustes.')
      }
      await send(escPos(lines))
      return
    }
    browserTicket.value = ticketText(lines, settings.paper)
    await nextTick()
    window.print()
  }

  return { settings, save, connection, bluetoothAvailable, connect, disconnect, print, browserTicket }
}
