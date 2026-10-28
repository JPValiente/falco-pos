<script setup lang="ts">
import type { LocalShift } from '~/types/pos'

useHead({ title: 'Turno' })

const pos = usePos()
const { state, money } = pos
const counted = ref<number | null>(null)
const notes = ref('')
const closing = ref(false)
const confirmOpen = ref(false)
const closed = ref<LocalShift | null>(null)

const current = computed(() => state.shift ? pos.closingOf(state.shift) : null)
const sellers = computed(() => state.shift ? pos.sellersOf(state.shift.clientId) : [])
const openAccounts = computed(() => state.accounts.length)
const preview = computed(() => state.shift && counted.value !== null ? pos.closingOf(state.shift, Number(counted.value)) : null)

async function close() {
  closing.value = true
  try {
    closed.value = await pos.closeShift(Number(counted.value) || 0, notes.value)
    counted.value = null
    notes.value = ''
    confirmOpen.value = false
  } finally {
    closing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4 p-4">
    <template v-if="closed">
      <div class="space-y-1 text-center">
        <UIcon
          name="i-lucide-circle-check"
          class="size-10 text-success"
        />
        <h1 class="text-lg font-bold text-highlighted">
          Turno {{ closed.number }} cerrado
        </h1>
        <p class="text-sm text-muted">
          {{ state.online ? 'El corte se envía a Falco.' : 'El corte se envía a Falco cuando vuelva el internet.' }}
        </p>
      </div>
      <PosClosing
        :closing="closed.closing!"
        :opening-float="closed.openingFloat"
        counted
      />
      <div class="flex gap-2">
        <UButton
          label="Ver cortes"
          to="/cortes"
          color="neutral"
          variant="outline"
          size="xl"
          block
          class="flex-1"
        />
        <UButton
          label="Abrir otro turno"
          to="/"
          size="xl"
          block
          class="flex-1"
        />
      </div>
    </template>

    <UEmpty
      v-else-if="!state.shift"
      icon="i-lucide-calculator"
      title="No hay un turno abierto"
      description="Ábrelo desde Vender para empezar."
      :actions="[{ label: 'Ir a vender', to: '/' }]"
      class="falco-card"
    />

    <template v-else>
      <div>
        <h1 class="text-lg font-bold text-highlighted">
          Turno {{ state.shift.number }}
        </h1>
        <p class="text-sm text-muted">
          Abrió {{ state.shift.sellerName }} · {{ formatDateTime(state.shift.openedAt) }}
        </p>
      </div>

      <div class="falco-card space-y-3 p-4">
        <h2 class="font-semibold text-highlighted">
          Vendedores del turno
        </h2>
        <ul
          v-if="sellers.length"
          class="divide-y divide-default text-sm"
        >
          <li
            v-for="seller in sellers"
            :key="seller.name"
            class="flex justify-between gap-2 py-1.5"
          >
            <span>{{ seller.name }} · {{ seller.count }} {{ seller.count === 1 ? 'venta' : 'ventas' }}</span>
            <span class="font-medium tabular-nums">{{ money(seller.total) }}</span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          Todavía no hay ventas.
        </p>
        <UButton
          label="Cambiar de vendedor"
          icon="i-lucide-users"
          color="neutral"
          variant="outline"
          :disabled="!state.online"
          @click="pos.switchSeller()"
        />
        <p
          v-if="!state.online"
          class="text-xs text-muted"
        >
          Sin internet no se puede: el siguiente vendedor entra con su usuario de Falco.
        </p>
      </div>

      <PosClosing
        v-if="current"
        :closing="current"
        :opening-float="state.shift.openingFloat"
      />

      <div class="falco-card space-y-4 p-4">
        <h2 class="font-semibold text-highlighted">
          Cerrar turno
        </h2>
        <UAlert
          v-if="openAccounts"
          color="warning"
          variant="subtle"
          icon="i-lucide-armchair"
          :title="`Hay ${openAccounts} ${openAccounts === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`"
          description="Puedes cerrar igual: las cuentas siguen abiertas en este dispositivo y se cobran en el siguiente turno."
        />
        <UFormField
          label="Efectivo contado en caja"
          help="Cuenta todo el efectivo, incluido el fondo inicial."
        >
          <UInputNumber
            v-model="counted"
            :min="0"
            :step-snapping="false"
            :step="1"
            :format-options="{ style: 'currency', currency: pos.currency.value }"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="preview"
          class="text-sm font-medium"
          :class="preview.difference < 0 ? 'text-error' : preview.difference > 0 ? 'text-warning' : 'text-success'"
        >
          {{ preview.difference < 0 ? `Faltan ${money(-preview.difference)}` : preview.difference > 0 ? `Sobran ${money(preview.difference)}` : 'Cuadra exacto' }}
        </p>
        <UFormField
          label="Nota"
          hint="Opcional"
        >
          <UTextarea
            v-model="notes"
            :rows="2"
            :maxlength="500"
            class="w-full"
          />
        </UFormField>
        <UButton
          label="Cerrar turno"
          icon="i-lucide-lock"
          color="neutral"
          size="xl"
          block
          :disabled="counted === null"
          @click="confirmOpen = true"
        />
      </div>
    </template>

    <UModal
      v-model:open="confirmOpen"
      title="¿Cerrar el turno?"
      description="El corte queda como está: no se puede cambiar después."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="ghost"
            @click="confirmOpen = false"
          />
          <UButton
            label="Cerrar turno"
            :loading="closing"
            @click="close"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
