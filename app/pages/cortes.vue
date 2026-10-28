<script setup lang="ts">
import type { LocalSale, LocalShift, ServerShift, SyncState } from '~/types/pos'
import { PAYMENT_METHODS } from '~/types/pos'

useHead({ title: 'Cortes de caja' })

const pos = usePos()
const printer = usePrinter()
const toast = useToast()
const api = useApi()
const { state, money } = pos
const expanded = ref<string | null>(state.shift?.clientId ?? state.shifts[0]?.clientId ?? null)

/** Older shifts than the device keeps, as Falco has them (only the seller's own, unless they manage the POS). */
const { data: server, error: serverError } = useAsyncData('server-shifts', async () => {
  if (!state.online || !state.setup) return null
  return (await api<{ items: ServerShift[] }>('/app/pos/shifts', { query: { terminalId: state.setup.terminal.id, size: 30 } })).items
})
const olderShifts = computed(() => (server.value ?? []).filter(s => !state.shifts.some(local => local.number === s.number)))

const SYNC: Record<SyncState, { label: string, color: 'success' | 'warning' | 'error' }> = {
  synced: { label: 'En Falco', color: 'success' },
  pending: { label: 'Por enviar', color: 'warning' },
  error: { label: 'Con error', color: 'error' }
}

function closingOf(shift: LocalShift) {
  return shift.closing ?? pos.closingOf(shift)
}

function methods(sale: LocalSale) {
  return sale.payments.map(p => PAYMENT_METHODS[p.method].label).join(', ')
}

async function reprint(sale: LocalSale) {
  try {
    await printer.print(sale, true)
  } catch (e) {
    toast.add({ color: 'warning', icon: 'i-lucide-printer', title: 'No se imprimió el ticket', description: e instanceof Error ? e.message : String(e) })
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 p-4">
    <div>
      <h1 class="text-lg font-bold text-highlighted">
        Cortes de caja
      </h1>
      <p class="text-sm text-muted">
        Los turnos de este dispositivo. Toca uno para ver sus ventas y reimprimir tickets.
      </p>
    </div>

    <UEmpty
      v-if="!state.shifts.length"
      icon="i-lucide-receipt-text"
      title="Aún no hay turnos en este dispositivo"
      class="falco-card"
    />

    <div
      v-for="shift in state.shifts"
      :key="shift.clientId"
      class="falco-card overflow-hidden"
    >
      <button
        type="button"
        class="flex w-full items-center gap-3 p-4 text-left"
        @click="expanded = expanded === shift.clientId ? null : shift.clientId"
      >
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">
            {{ shift.number }}
            <UBadge
              :label="shift.closedAt ? 'Cerrado' : 'Abierto'"
              :color="shift.closedAt ? 'neutral' : 'info'"
              variant="subtle"
              class="ms-1"
            />
            <UBadge
              :label="SYNC[shift.sync].label"
              :color="SYNC[shift.sync].color"
              variant="subtle"
              class="ms-1"
            />
          </p>
          <p class="text-sm text-muted">
            {{ shift.sellerName }} · {{ formatDateTime(shift.openedAt) }}<template v-if="shift.closedAt">
              – {{ formatTime(shift.closedAt) }}
            </template>
          </p>
          <p
            v-if="shift.error"
            class="text-sm text-error"
          >
            {{ shift.error }}
          </p>
        </div>
        <div class="text-right">
          <p class="font-semibold text-highlighted tabular-nums">
            {{ money(closingOf(shift).salesTotal) }}
          </p>
          <p
            v-if="shift.closing"
            class="text-xs tabular-nums"
            :class="shift.closing.difference < 0 ? 'text-error' : shift.closing.difference > 0 ? 'text-warning' : 'text-success'"
          >
            {{ shift.closing.difference === 0 ? 'Cuadra' : money(shift.closing.difference) }}
          </p>
        </div>
        <UIcon
          :name="expanded === shift.clientId ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-5 text-muted"
        />
      </button>

      <div
        v-if="expanded === shift.clientId"
        class="space-y-3 border-t border-default bg-elevated/30 p-4"
      >
        <PosClosing
          :closing="closingOf(shift)"
          :opening-float="shift.openingFloat"
          :counted="!!shift.closing"
        />
        <UEmpty
          v-if="!pos.salesOf(shift.clientId).length"
          icon="i-lucide-receipt"
          title="Sin ventas en este turno"
        />
        <ul
          v-else
          class="falco-card divide-y divide-default"
        >
          <li
            v-for="sale in pos.salesOf(shift.clientId)"
            :key="sale.clientId"
            class="flex items-center gap-3 p-3"
          >
            <div class="min-w-0 flex-1">
              <p class="font-mono text-sm text-highlighted">
                {{ sale.number }}
                <span
                  v-if="sale.erpNumber"
                  class="text-xs text-muted"
                >· {{ sale.erpNumber }}</span>
              </p>
              <p class="text-xs text-muted">
                {{ formatTime(sale.soldAt) }} · {{ methods(sale) }}<template v-if="sale.account">
                  · {{ sale.account }}
                </template>
              </p>
              <p
                v-if="sale.error"
                class="text-xs text-error"
              >
                {{ sale.error }}
              </p>
            </div>
            <UBadge
              :label="SYNC[sale.sync].label"
              :color="SYNC[sale.sync].color"
              variant="subtle"
            />
            <p class="w-24 text-right text-sm font-semibold tabular-nums">
              {{ money(sale.totals.total) }}
            </p>
            <UButton
              icon="i-lucide-printer"
              color="neutral"
              variant="ghost"
              :aria-label="`Reimprimir ${sale.number}`"
              @click="reprint(sale)"
            />
          </li>
        </ul>
      </div>
    </div>

    <section
      v-if="olderShifts.length"
      class="space-y-2"
    >
      <h2 class="font-semibold text-highlighted">
        Anteriores, en Falco
      </h2>
      <div class="falco-card divide-y divide-default">
        <div
          v-for="shift in olderShifts"
          :key="shift.id"
          class="flex items-center gap-3 p-3 text-sm"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted">
              {{ shift.number }}
            </p>
            <p class="text-xs text-muted">
              {{ shift.seller?.name }} · {{ formatDateTime(shift.openedAt) }}
            </p>
          </div>
          <p class="tabular-nums">
            {{ money(shift.salesTotal ?? shift.syncedTotal) }}
          </p>
          <p
            v-if="shift.difference !== null"
            class="w-20 text-right text-xs tabular-nums"
            :class="shift.difference < 0 ? 'text-error' : shift.difference > 0 ? 'text-warning' : 'text-success'"
          >
            {{ Number(shift.difference) === 0 ? 'Cuadra' : money(shift.difference) }}
          </p>
        </div>
      </div>
    </section>
    <p
      v-else-if="serverError"
      class="text-sm text-muted"
    >
      No se pudieron traer los turnos anteriores de Falco: {{ errorMessage(serverError) }}
    </p>
  </div>
</template>
