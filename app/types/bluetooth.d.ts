/** The part of Web Bluetooth (Chrome on Android, desktop) the printer uses; not in TypeScript's DOM types. */
interface BluetoothCharacteristicProperties {
  write: boolean
  writeWithoutResponse: boolean
}

interface BluetoothRemoteGATTCharacteristic {
  properties: BluetoothCharacteristicProperties
  writeValue(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothDevice extends EventTarget {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
}

interface Bluetooth {
  requestDevice(options: { acceptAllDevices?: boolean, filters?: { services?: string[] }[], optionalServices?: string[] }): Promise<BluetoothDevice>
  getDevices?(): Promise<BluetoothDevice[]>
}

interface Navigator {
  readonly bluetooth?: Bluetooth
}
