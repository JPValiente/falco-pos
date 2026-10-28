/**
 * The device's own data (IndexedDB): the setup and catalog, tickets and shifts until Falco has them
 * (and a while after, for the cortes and reprints), and the open accounts of the stations.
 */
const NAME = 'falco-pos'
const VERSION = 1

export type Store = 'kv' | 'sales' | 'shifts' | 'accounts'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('kv')
      db.createObjectStore('sales', { keyPath: 'clientId' }).createIndex('shift', 'shiftClientId')
      db.createObjectStore('shifts', { keyPath: 'clientId' })
      db.createObjectStore('accounts', { keyPath: 'stationId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = null
      reject(request.error)
    }
  })
  return opening
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function store(name: Store, mode: IDBTransactionMode) {
  return (await open()).transaction(name, mode).objectStore(name)
}

/** Vue proxies cannot be stored: a plain copy. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const db = {
  async get<T>(name: Store, key: string): Promise<T | undefined> {
    return done((await store(name, 'readonly')).get(key))
  },
  async all<T>(name: Store): Promise<T[]> {
    return done((await store(name, 'readonly')).getAll())
  },
  async byShift<T>(shiftClientId: string): Promise<T[]> {
    return done((await store('sales', 'readonly')).index('shift').getAll(shiftClientId))
  },
  async put<T>(name: Store, value: T, key?: string): Promise<void> {
    await done((await store(name, 'readwrite')).put(plain(value), key))
  },
  async delete(name: Store, key: string): Promise<void> {
    await done((await store(name, 'readwrite')).delete(key))
  },
  /** Everything of this device (another company signed in on it). */
  async clear(): Promise<void> {
    for (const name of ['kv', 'sales', 'shifts', 'accounts'] as Store[]) {
      await done((await store(name, 'readwrite')).clear())
    }
  }
}
