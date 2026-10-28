<script setup lang="ts">
import type { LocalSale, Payment, PaymentMethod } from '~/types/pos'
import { PAYMENT_METHODS } from '~/types/pos'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ charged: [sale: LocalSale, print: boolean] }>()

const pos = usePos()
const printer = usePrinter()
const { money, cartTotals } = pos

interface Row {
  method: PaymentMethod
  amount: number
  reference: string
}

const rows = ref<Row[]>([])
const print = ref(printer.settings.enabled)
const saving = ref(false)
const total = computed(() => cartTotals.value.total)

watch(open, (value) => {
  if (value) {
    rows.value = [{ method: 'CASH', amount: total.value, reference: '' }]
    print.value = printer.settings.enabled
  }
})

const paid = computed(() => round(rows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)))
const nonCash = computed(() => round(rows.value.filter(r => r.method !== 'CASH').reduce((sum, r) => sum + (Number(r.amount) || 0), 0)))
const change = computed(() => Math.max(0, round(paid.value - total.value)))
const missing = computed(() => Math.max(0, round(total.value - paid.value)))
/** Only cash gives change: transfers and cards are for what is owed at most. */
const problem = computed(() => {
  if (missing.value > 0) return `Faltan ${money(missing.value)}`
  if (nonCash.value > total.value) return 'Transferencia y tarjeta no pueden pasar del total'
  if (change.value > 0 && !rows.value.some(r => r.method === 'CASH')) return 'Solo el efectivo da vuelto'
  return null
})

/** Bills to receive quickly: the exact amount and the next round ones. */
const quick = computed(() => {
  const due = round(total.value - nonCash.value)
  const options = new Set<number>([due])
  for (const bill of [5, 10, 20, 50, 100, 200]) {
    const next = Math.ceil(due / bill) * bill
    if (next > due) options.add(next)
  }
  return [...options].slice(0, 5)
})

function setMethod(row: Row, method: PaymentMethod) {
  row.method = method
}

function addRow() {
  rows.value.push({ method: 'TRANSFER', amount: missing.value, reference: '' })
}

function setCash(amount: number) {
  const cash = rows.value.find(r => r.method === 'CASH')
  if (cash) {
    cash.amount = amount
  } else {
    rows.value.push({ method: 'CASH', amount, reference: '' })
  }
}

async function confirm() {
  if (problem.value) {
    return
  }
  saving.value = true
  try {
    // Cash applied to the sale is what was received minus the change
    let toReturn = change.value
    const payments: Payment[] = rows.value.filter(r => Number(r.amount) > 0).map((r): Payment => {
      const amount = Number(r.amount)
      if (r.method !== 'CASH') {
        return { method: r.method, amount, reference: r.reference.trim() || undefined }
      }
      const back = Math.min(toReturn, amount)
      toReturn = round(toReturn - back)
      return { method: 'CASH', amount: round(amount - back), received: amount }
    }).filter(p => p.amount > 0 || p.received)
    const sale = await pos.charge(payments, change.value)
    emit('charged', sale, print.value)
    open.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cobrar"
    :description="`Total ${money(total)}`"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4">
        <div
          v-for="(row, index) in rows"
          :key="index"
          class="falco-card space-y-3 p-3"
        >
          <div class="flex gap-2">
            <div class="grid flex-1 grid-cols-3 gap-2">
              <UButton
                v-for="(info, method) in PAYMENT_METHODS"
                :key="method"
                :label="info.label"
                :icon="info.icon"
                :color="row.method === method ? 'primary' : 'neutral'"
                :variant="row.method === method ? 'solid' : 'outline'"
                size="lg"
                block
                class="flex-col gap-1 text-xs sm:flex-row sm:text-sm"
                @click="setMethod(row, method)"
              />
            </div>
            <UButton
              v-if="rows.length > 1"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              aria-label="Quitar pago"
              @click="rows.splice(index, 1)"
            />
          </div>
          <!-- Phones: the amount on its own line, wide enough to read -->
          <div class="grid gap-2 sm:grid-cols-2">
            <UFormField :label="row.method === 'CASH' ? 'Recibido' : 'Monto'">
              <UInputNumber
                v-model="row.amount"
                :min="0"
                :step="1"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="row.method !== 'CASH'"
              label="Referencia"
              hint="Opcional"
            >
              <UInput
                v-model="row.reference"
                size="xl"
                class="w-full"
                :placeholder="row.method === 'CARD' ? 'Autorización' : 'No. de transferencia'"
              />
            </UFormField>
          </div>
          <div
            v-if="row.method === 'CASH'"
            class="flex flex-wrap gap-2"
          >
            <UButton
              v-for="amount in quick"
              :key="amount"
              :label="money(amount)"
              color="neutral"
              variant="soft"
              @click="setCash(amount)"
            />
          </div>
        </div>

        <UButton
          v-if="rows.length < 3"
          label="Pagar con otro método también"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          block
          @click="addRow"
        />

        <div class="flex items-baseline justify-between rounded-xl bg-elevated/60 p-3">
          <span class="font-medium">{{ change > 0 ? 'Vuelto' : 'Pagado' }}</span>
          <span class="text-3xl font-bold tabular-nums text-highlighted">{{ money(change > 0 ? change : paid) }}</span>
        </div>

        <USwitch
          v-model="print"
          label="Imprimir ticket"
          size="lg"
        />

        <UAlert
          v-if="problem"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :description="problem"
        />

        <UButton
          :label="`Cobrar ${money(total)}`"
          icon="i-lucide-check"
          size="xl"
          block
          :disabled="!!problem"
          :loading="saving"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
