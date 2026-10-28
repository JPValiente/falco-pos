<script setup lang="ts">
import type { LocalSale } from '~/types/pos'

useHead({ title: 'Ajustes' })

const pos = usePos()
const auth = useAuth()
const printer = usePrinter()
const toast = useToast()
const { state, pending } = pos
const updating = ref(false)
const loggingOut = ref(false)

const canLeave = computed(() => !state.shift && pending.value === 0)
/** Another seller may take over with the shift open; the next one signs in, so it needs internet. */
const canSwitch = computed(() => canLeave.value || state.online)

function notify(title: string, e: unknown) {
  toast.add({ color: 'error', icon: 'i-lucide-circle-alert', title, description: statusOf(e) || !(e instanceof Error) ? errorMessage(e) : e.message })
}

async function updateCatalog() {
  updating.value = true
  try {
    await pos.downloadCatalog()
    toast.add({ color: 'success', icon: 'i-lucide-check', title: 'Catálogo actualizado', description: `${state.catalog?.products.length ?? 0} productos` })
  } catch (e) {
    notify('No se pudo actualizar el catálogo', e)
  } finally {
    updating.value = false
  }
}

async function connect() {
  try {
    await printer.connect()
    toast.add({ color: 'success', icon: 'i-lucide-printer', title: `Impresora conectada: ${printer.connection.device?.name ?? 'Bluetooth'}` })
  } catch (e) {
    if ((e as Error)?.name !== 'NotFoundError') {
      notify('No se pudo conectar la impresora', e)
    }
  }
}

/** A sample ticket, to check the roll and the letters. */
async function testPrint() {
  if (!state.catalog) return
  const lines = [{ productId: 'x', code: 'X', name: 'Producto de prueba con nombre largo, ñandú y café', unitSymbol: null, quantity: 2, unitPrice: 12.5, discountPercent: 0 }]
  const sum = totals(lines, state.catalog.tax.rate, state.catalog.tax.pricesIncludeTax)
  const received = Math.ceil(sum.total / 50) * 50
  const sample: LocalSale = {
    clientId: 'test', shiftClientId: 'test', sellerId: null, sellerName: null, number: 'PRUEBA', soldAt: new Date().toISOString(), customer: null, lines,
    payments: [{ method: 'CASH', amount: sum.total, received }], totals: sum, change: round(received - sum.total),
    account: null, notes: null, sync: 'synced', error: null, erpNumber: null
  }
  try {
    await printer.print(sample)
  } catch (e) {
    notify('No se imprimió', e)
  }
}

async function logout() {
  loggingOut.value = true
  try {
    await pos.switchSeller()
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4 p-4">
    <h1 class="text-lg font-bold text-highlighted">
      Ajustes
    </h1>

    <section class="falco-card space-y-3 p-4">
      <h2 class="font-semibold text-highlighted">
        Envío a Falco
      </h2>
      <p class="text-sm text-muted">
        <template v-if="pending">
          {{ pending }} pendientes de enviar.
        </template>
        <template v-else>
          Todo está en Falco.
        </template>
        <template v-if="state.lastSyncAt">
          Último envío: {{ formatDateTime(state.lastSyncAt) }}
        </template>
      </p>
      <UAlert
        v-if="state.needsLogin"
        color="error"
        variant="subtle"
        icon="i-lucide-log-in"
        title="La sesión venció"
        description="Vuelve a entrar para enviar lo pendiente. No se pierde nada."
        :actions="[{ label: 'Entrar', to: '/login' }]"
      />
      <UAlert
        v-else-if="state.syncError"
        color="warning"
        variant="subtle"
        icon="i-lucide-wifi-off"
        :description="state.syncError"
      />
      <UAlert
        v-for="item in pos.failed.value"
        :key="item.clientId"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="`No se registró ${item.number}`"
        :description="`${item.error ?? ''} Se vuelve a intentar en cada envío; si no se resuelve, avísale al administrador.`"
      />
      <UButton
        label="Enviar ahora"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="state.syncing"
        :disabled="!state.online || !pending"
        @click="pos.sync()"
      />
    </section>

    <section class="falco-card space-y-4 p-4">
      <h2 class="font-semibold text-highlighted">
        Ticket
      </h2>
      <USwitch
        v-model="printer.settings.enabled"
        label="Imprimir el ticket al cobrar"
        description="Se puede cambiar en cada venta."
        @update:model-value="printer.save()"
      />
      <UFormField label="Ancho del papel">
        <URadioGroup
          v-model="printer.settings.paper"
          orientation="horizontal"
          :items="[{ label: '58 mm', value: 58 }, { label: '80 mm', value: 80 }]"
          @update:model-value="printer.save()"
        />
      </UFormField>
      <UFormField label="Impresora">
        <URadioGroup
          v-model="printer.settings.mode"
          :items="[
            { label: 'Impresora térmica Bluetooth', description: 'Chrome en Android o computadora.', value: 'bluetooth', disabled: !printer.bluetoothAvailable.value },
            { label: 'Imprimir con el navegador', description: 'iPhone, iPad o impresoras de la computadora.', value: 'browser' }
          ]"
          @update:model-value="printer.save()"
        />
      </UFormField>
      <p
        v-if="!printer.bluetoothAvailable.value"
        class="text-sm text-muted"
      >
        Este navegador no tiene Bluetooth (en iPhone pasa siempre): el ticket se imprime con el navegador.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="printer.settings.mode === 'bluetooth' && printer.bluetoothAvailable.value"
          :label="printer.connection.device ? `Conectada: ${printer.connection.device.name ?? 'impresora'}` : 'Conectar impresora'"
          icon="i-lucide-bluetooth"
          :color="printer.connection.device ? 'success' : 'primary'"
          :variant="printer.connection.device ? 'soft' : 'solid'"
          :loading="printer.connection.connecting"
          @click="connect"
        />
        <UButton
          label="Imprimir prueba"
          icon="i-lucide-printer"
          color="neutral"
          variant="outline"
          :disabled="!state.catalog"
          @click="testPrint"
        />
      </div>
    </section>

    <section
      v-if="state.setup"
      class="falco-card space-y-3 p-4"
    >
      <h2 class="font-semibold text-highlighted">
        Punto de venta
      </h2>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <dt class="text-muted">
          Punto de venta
        </dt>
        <dd>{{ state.setup.terminal.name }} ({{ state.setup.terminal.code }})</dd>
        <dt class="text-muted">
          Bodega
        </dt>
        <dd>{{ state.setup.terminal.warehouse?.name }}</dd>
        <dt class="text-muted">
          Este dispositivo
        </dt>
        <dd>{{ state.setup.deviceName }}</dd>
        <dt class="text-muted">
          Catálogo
        </dt>
        <dd>{{ state.catalog ? `${state.catalog.products.length} productos · ${formatDateTime(state.catalog.generatedAt)}` : '—' }}</dd>
        <dt class="text-muted">
          Último ticket
        </dt>
        <dd class="font-mono">
          {{ state.setup.lastNumber ? `${state.setup.terminal.code}-${String(state.setup.lastNumber).padStart(5, '0')}` : '—' }}
        </dd>
      </dl>
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Actualizar catálogo y precios"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          :loading="updating"
          :disabled="!state.online"
          @click="updateCatalog"
        />
        <UButton
          label="Cambiar de punto de venta"
          icon="i-lucide-monitor-smartphone"
          color="neutral"
          variant="ghost"
          to="/terminal"
          :disabled="!canLeave || !state.online"
        />
      </div>
    </section>

    <section class="falco-card space-y-3 p-4">
      <h2 class="font-semibold text-highlighted">
        Sesión
      </h2>
      <p class="text-sm text-muted">
        {{ auth.session.value?.name }}.
        <template v-if="!canLeave && state.online">
          El turno sigue abierto: otro vendedor puede entrar y seguir vendiendo. Cada ticket guarda quién lo vendió.
        </template>
        <template v-else-if="!canLeave">
          Sin internet no se puede cambiar de vendedor: el siguiente tiene que entrar con su usuario de Falco.
        </template>
      </p>
      <UButton
        :label="canLeave ? 'Salir' : 'Cambiar de vendedor'"
        :icon="canLeave ? 'i-lucide-log-out' : 'i-lucide-users'"
        :color="canLeave ? 'error' : 'neutral'"
        :variant="canLeave ? 'soft' : 'outline'"
        :disabled="!canSwitch"
        :loading="loggingOut"
        @click="logout"
      />
    </section>
  </div>
</template>
