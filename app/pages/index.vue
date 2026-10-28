<script setup lang="ts">
import type { CartOption, LocalSale, Product } from '~/types/pos'

useHead({ title: 'Vender' })

const pos = usePos()
const printer = usePrinter()
const toast = useToast()
const { state, money, cartTotals, cartCount } = pos

const search = ref('')
const category = ref<string | null>(null)
const cartOpen = ref(false)
const chargeOpen = ref(false)
const customerOpen = ref(false)
const stationsOpen = ref(false)
/** The last sale's change; while it shows, a lost terminal (FA-012) waits so the cashier still sees it. */
const sold = ref<LocalSale | null>(null)
const openingFloat = ref(0)
const opening = ref(false)

const products = computed(() => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return (state.catalog?.products ?? []).filter(p =>
    (!category.value || p.categoryId === category.value)
    && words.every(w => p.name.toLowerCase().includes(w) || p.code.toLowerCase().includes(w)))
})

/** Products whose stock ran out still sell (the ERP warns the administrator); here they only show it. */
function stockLabel(product: Product) {
  const stock = pos.stockOf(product)
  return `${formatQuantity(stock)}${product.unitSymbol ? ` ${product.unitSymbol}` : ''}`
}

/** A product with options asks for them first. */
const choosing = ref<Product | null>(null)
function add(product: Product) {
  if (pos.optionGroupsOf(product).length) {
    choosing.value = product
  } else {
    pos.addProduct(product)
  }
}
function addWithOptions(options: CartOption[]) {
  if (choosing.value) {
    pos.addProduct(choosing.value, 1, options)
  }
  choosing.value = null
}

async function openShift() {
  opening.value = true
  try {
    await pos.openShift(Number(openingFloat.value) || 0)
  } finally {
    opening.value = false
  }
}

async function printSale(sale: LocalSale) {
  try {
    await printer.print(sale)
  } catch (e) {
    toast.add({ color: 'warning', icon: 'i-lucide-printer', title: 'No se imprimió el ticket', description: e instanceof Error ? e.message : String(e) })
  }
}

async function charged(sale: LocalSale, print: boolean) {
  cartOpen.value = false
  sold.value = sale
  if (print) {
    await printSale(sale)
  }
}

function startCharge() {
  if (!cartOpen.value) {
    chargeOpen.value = true
    return
  }
  // From the sliding panel: once it has closed, or the closing takes the new dialog with it
  cartOpen.value = false
  setTimeout(() => {
    chargeOpen.value = true
  }, 300)
}
</script>

<template>
  <div
    v-if="!state.canSell && !sold"
    class="mx-auto max-w-md p-4"
  >
    <UEmpty
      icon="i-lucide-lock"
      title="Ya no tienes asignado este punto de venta"
      :description="`El administrador te quitó ${state.setup?.terminal.name ?? 'este punto de venta'}. Lo que vendiste está guardado${pos.pending.value ? ' y se envía a Falco' : ' en Falco'}. Para seguir vendiendo, entra con un vendedor asignado.`"
      :actions="[{ label: 'Cambiar de vendedor', icon: 'i-lucide-users', onClick: () => { pos.switchSeller() }, disabled: !state.online }]"
      class="falco-card"
    />
  </div>

  <div
    v-else-if="!state.shift"
    class="mx-auto max-w-md space-y-4 p-4"
  >
    <div class="falco-card space-y-4 p-6">
      <div class="space-y-1 text-center">
        <UIcon
          name="i-lucide-door-open"
          class="size-10 text-primary"
        />
        <h1 class="text-lg font-bold text-highlighted">
          Abre tu turno para vender
        </h1>
        <p class="text-sm text-muted">
          Cuenta el efectivo con el que empiezas en caja (el fondo). Al cerrar, se compara con lo que debería haber.
        </p>
      </div>
      <form
        class="space-y-4"
        @submit.prevent="openShift"
      >
        <UFormField label="Fondo inicial en efectivo">
          <UInputNumber
            v-model="openingFloat"
            :min="0"
            :step-snapping="false"
            :step="1"
            :format-options="{ style: 'currency', currency: pos.currency.value }"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Abrir turno"
          icon="i-lucide-play"
          size="xl"
          block
          :loading="opening"
        />
      </form>
    </div>
  </div>

  <div
    v-else
    class="flex h-full"
  >
    <section class="flex min-w-0 flex-1 flex-col">
      <div class="space-y-2 border-b border-default bg-default p-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar producto o código"
          size="xl"
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
        >
          <template
            v-if="search"
            #trailing
          >
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="link"
              aria-label="Limpiar búsqueda"
              @click="search = ''"
            />
          </template>
        </UInput>
        <div
          v-if="state.catalog?.categories.length"
          class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1"
        >
          <UButton
            label="Todo"
            :color="!category ? 'primary' : 'neutral'"
            :variant="!category ? 'solid' : 'outline'"
            class="shrink-0"
            @click="category = null"
          />
          <UButton
            v-for="item in state.catalog.categories"
            :key="item.id"
            :label="item.name"
            :color="category === item.id ? 'primary' : 'neutral'"
            :variant="category === item.id ? 'solid' : 'outline'"
            class="shrink-0"
            @click="category = item.id"
          />
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <UEmpty
          v-if="!products.length"
          icon="i-lucide-package-search"
          :title="search ? `Nada con &quot;${search}&quot;` : 'No hay productos para vender'"
          description="El catálogo sale de los productos vendibles con existencia de Falco. Actualízalo en Ajustes."
        />
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          <button
            v-for="product in products"
            :key="product.id"
            type="button"
            class="falco-card flex min-h-24 flex-col justify-between gap-2 p-3 text-left transition active:scale-[0.98]"
            @click="add(product)"
          >
            <span class="line-clamp-2 text-sm font-semibold text-highlighted">{{ product.name }}</span>
            <span class="flex items-end justify-between gap-1">
              <span class="font-bold text-primary tabular-nums">{{ money(product.price) }}</span>
              <!-- Prepared when sold: no stock of its own (the bell warns about its supplies) -->
              <UIcon
                v-if="product.instant"
                name="i-lucide-coffee"
                class="size-4 text-muted"
                aria-label="Se prepara al venderlo"
              />
              <span
                v-else
                class="text-xs tabular-nums"
                :class="pos.stockOf(product) <= 0 ? 'font-medium text-warning' : 'text-muted'"
              >{{ stockLabel(product) }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Phones and small tablets: the sale opens from the bottom; Cobrar goes straight to charging -->
      <div class="flex gap-2 border-t border-default bg-default p-3 lg:hidden">
        <UButton
          size="xl"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-up"
          class="min-w-0 flex-1"
          @click="cartOpen = true"
        >
          <span class="truncate">
            {{ pos.station.value ? pos.station.value.name : 'Venta' }} · {{ formatQuantity(cartCount) }} {{ cartCount === 1 ? 'producto' : 'productos' }}
          </span>
        </UButton>
        <UButton
          size="xl"
          icon="i-lucide-hand-coins"
          :label="money(cartTotals.total)"
          :disabled="!state.cart.length || cartTotals.total <= 0"
          class="tabular-nums"
          @click="startCharge"
        />
      </div>
    </section>

    <aside class="hidden w-96 shrink-0 border-s border-default bg-default lg:block">
      <PosCart
        @charge="startCharge"
        @customer="customerOpen = true"
        @stations="stationsOpen = true"
      />
    </aside>

    <USlideover
      v-model:open="cartOpen"
      side="bottom"
      title="Venta"
      :ui="{ content: 'h-[90dvh]', body: 'p-0 sm:p-0' }"
    >
      <template #body>
        <PosCart
          @charge="startCharge"
          @customer="customerOpen = true"
          @stations="stationsOpen = true"
        />
      </template>
    </USlideover>

    <PosOptions
      :product="choosing"
      @close="choosing = null"
      @add="addWithOptions"
    />

    <PosChargeModal
      v-model:open="chargeOpen"
      @charged="charged"
    />
    <PosCustomerPicker v-model:open="customerOpen" />
    <PosStationPicker v-model:open="stationsOpen" />

    <UModal
      :open="!!sold"
      :dismissible="false"
      :close="false"
      :title="sold ? `Venta ${sold.number}` : ''"
      @update:open="value => { if (!value) sold = null }"
    >
      <template #body>
        <div
          v-if="sold"
          class="space-y-4 text-center"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="size-12 text-success"
          />
          <div v-if="sold.change > 0">
            <p class="text-sm text-muted">
              Vuelto
            </p>
            <p class="text-4xl font-bold text-highlighted tabular-nums">
              {{ money(sold.change) }}
            </p>
          </div>
          <p
            v-else
            class="text-lg font-semibold text-highlighted"
          >
            Cobrado {{ money(sold.totals.total) }}
          </p>
          <p class="text-xs text-muted">
            {{ state.online ? 'Se envía a Falco ahora.' : 'Se envía a Falco cuando vuelva el internet.' }}
          </p>
          <div class="flex gap-2">
            <UButton
              label="Imprimir"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              size="xl"
              class="flex-1"
              block
              @click="printSale(sold)"
            />
            <UButton
              label="Nueva venta"
              icon="i-lucide-plus"
              size="xl"
              class="flex-1"
              block
              autofocus
              @click="sold = null"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
