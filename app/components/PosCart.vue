<script setup lang="ts">
import type { CartLine } from '~/types/pos'

const emit = defineEmits<{ charge: [], customer: [], stations: [] }>()

const pos = usePos()
const { state, money, cartTotals } = pos
const canDiscount = computed(() => !!state.catalog?.seller.canDiscount)
const usesAccounts = computed(() => !!state.setup?.terminal.usesAccounts)
const discountLine = ref<CartLine | null>(null)
const discountValue = ref(0)

function editDiscount(line: CartLine) {
  discountLine.value = line
  discountValue.value = line.discountPercent
}

function saveDiscount() {
  if (discountLine.value) {
    pos.setDiscount(discountLine.value.productId, Number(discountValue.value) || 0)
  }
  discountLine.value = null
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="space-y-2 border-b border-default p-3">
      <UButton
        v-if="usesAccounts"
        :label="pos.station.value ? `Cuenta: ${pos.station.value.name}` : 'Venta directa'"
        :icon="pos.station.value ? 'i-lucide-armchair' : 'i-lucide-shopping-bag'"
        trailing-icon="i-lucide-chevron-down"
        :color="pos.station.value ? 'primary' : 'neutral'"
        variant="soft"
        block
        class="justify-between"
        @click="emit('stations')"
      />
      <UButton
        :label="state.customer?.name ?? state.catalog?.finalConsumer.name ?? 'Consumidor final'"
        icon="i-lucide-user"
        trailing-icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        block
        class="justify-between"
        @click="emit('customer')"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <UEmpty
        v-if="!state.cart.length"
        icon="i-lucide-shopping-cart"
        title="Aún no hay productos"
        description="Toca un producto para agregarlo."
      />
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="line in state.cart"
          :key="line.productId"
          class="space-y-2 p-3"
        >
          <div class="flex items-start gap-2">
            <p class="min-w-0 flex-1 text-sm font-medium text-highlighted">
              {{ line.name }}
            </p>
            <p class="text-sm font-semibold text-highlighted tabular-nums">
              {{ money(lineAmount(line)) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UInputNumber
              :model-value="line.quantity"
              :min="0"
              :step="1"
              :format-options="{ maximumFractionDigits: 4 }"
              size="md"
              class="w-32"
              :aria-label="`Cantidad de ${line.name}`"
              @update:model-value="value => pos.setQuantity(line.productId, Number(value) || 0)"
            />
            <span class="text-xs text-muted">× {{ money(line.unitPrice) }}</span>
            <UBadge
              v-if="line.discountPercent"
              :label="`-${line.discountPercent}%`"
              color="warning"
              variant="subtle"
            />
            <div class="ms-auto flex gap-1">
              <UButton
                v-if="canDiscount"
                icon="i-lucide-percent"
                color="neutral"
                variant="ghost"
                :aria-label="`Descuento a ${line.name}`"
                @click="editDiscount(line)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :aria-label="`Quitar ${line.name}`"
                @click="pos.setQuantity(line.productId, 0)"
              />
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div class="space-y-1 border-t border-default p-3 text-sm">
      <div
        v-if="cartTotals.discount > 0"
        class="flex justify-between text-muted"
      >
        <span>Descuento</span><span class="tabular-nums">-{{ money(cartTotals.discount) }}</span>
      </div>
      <div
        v-if="cartTotals.tax > 0"
        class="flex justify-between text-muted"
      >
        <span>{{ state.catalog?.tax.label }}{{ state.catalog?.tax.pricesIncludeTax ? ' incluido' : '' }}</span>
        <span class="tabular-nums">{{ money(cartTotals.tax) }}</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="font-semibold text-highlighted">Total</span>
        <span class="text-2xl font-bold text-highlighted tabular-nums">{{ money(cartTotals.total) }}</span>
      </div>
      <div class="flex gap-2 pt-2">
        <UButton
          v-if="state.cart.length"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          size="xl"
          :aria-label="pos.station.value ? 'Vaciar la cuenta' : 'Vaciar la venta'"
          @click="pos.clearCart()"
        />
        <UButton
          label="Cobrar"
          icon="i-lucide-hand-coins"
          size="xl"
          block
          class="flex-1"
          :disabled="!state.cart.length || cartTotals.total <= 0"
          @click="emit('charge')"
        />
      </div>
    </div>

    <UModal
      :open="!!discountLine"
      title="Descuento"
      :description="discountLine?.name"
      @update:open="open => { if (!open) discountLine = null }"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="saveDiscount"
        >
          <UFormField label="Porcentaje de descuento">
            <UInputNumber
              v-model="discountValue"
              :min="0"
              :max="100"
              :step="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            label="Aplicar"
            size="xl"
            block
          />
        </form>
      </template>
    </UModal>
  </div>
</template>
