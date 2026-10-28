<script setup lang="ts">
import type { CartOption, OptionGroup, Product } from '~/types/pos'

/** The options of a product before adding it ("Leche: almendra", "Extras: shot extra ×2"). */
const props = defineProps<{ product: Product | null }>()
const emit = defineEmits<{ close: [], add: [options: CartOption[]] }>()

const pos = usePos()
const { money } = pos
const groups = computed<OptionGroup[]>(() => props.product ? pos.optionGroupsOf(props.product) : [])
const chosen = ref<Record<string, number>>({})
watch(() => props.product, () => {
  chosen.value = {}
})

const timesIn = (g: OptionGroup) => g.options.reduce((sum, o) => sum + (chosen.value[o.id] ?? 0), 0)
const missing = computed(() => groups.value.filter(g => g.required && timesIn(g) === 0))
const extra = computed(() => groups.value.flatMap(g => g.options).reduce((sum, o) => sum + o.price * (chosen.value[o.id] ?? 0), 0))

function pickOne(g: OptionGroup, optionId: string) {
  const again = chosen.value[optionId] === 1
  g.options.forEach((o) => {
    chosen.value[o.id] = 0
  })
  // Touching the chosen one again unchooses it, unless it is required
  chosen.value[optionId] = again && !g.required ? 0 : 1
}

function step(g: OptionGroup, optionId: string, by: number) {
  const now = chosen.value[optionId] ?? 0
  if (by > 0 && g.maxQuantity && timesIn(g) >= g.maxQuantity) {
    return
  }
  chosen.value[optionId] = Math.max(0, now + by)
}

function add() {
  if (missing.value.length) {
    return
  }
  emit('add', groups.value.flatMap(g => g.options
    .filter(o => (chosen.value[o.id] ?? 0) > 0)
    .map(o => ({ optionId: o.id, group: g.name, name: o.name, quantity: chosen.value[o.id]!, price: o.price }))))
}
</script>

<template>
  <UModal
    :open="!!product"
    :title="product?.name"
    description="Elige las opciones antes de agregarlo."
    @update:open="open => { if (!open) emit('close') }"
  >
    <template #body>
      <div class="space-y-5">
        <div
          v-for="g in groups"
          :key="g.id"
          class="space-y-2"
        >
          <p class="font-semibold text-highlighted">
            {{ g.name }}
            <span class="text-xs font-normal text-muted">
              {{ g.multiple ? (g.maxQuantity ? `Hasta ${g.maxQuantity}` : 'Varias') : 'Elige una' }}{{ g.required ? ' · obligatorio' : '' }}
            </span>
          </p>
          <div
            v-if="!g.multiple"
            class="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            <UButton
              v-for="o in g.options"
              :key="o.id"
              :label="o.price ? `${o.name} +${money(o.price)}` : o.name"
              :color="chosen[o.id] ? 'primary' : 'neutral'"
              :variant="chosen[o.id] ? 'solid' : 'outline'"
              size="lg"
              block
              class="justify-center"
              @click="pickOne(g, o.id)"
            />
          </div>
          <div
            v-else
            class="divide-y divide-default rounded-md border border-default"
          >
            <div
              v-for="o in g.options"
              :key="o.id"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span>
                {{ o.name }}
                <span
                  v-if="o.price"
                  class="text-sm text-muted"
                >+{{ money(o.price) }}</span>
              </span>
              <div class="flex items-center gap-2">
                <UButton
                  icon="i-lucide-minus"
                  color="neutral"
                  variant="outline"
                  :disabled="!chosen[o.id]"
                  :aria-label="`Menos ${o.name}`"
                  @click="step(g, o.id, -1)"
                />
                <span class="w-6 text-center font-semibold tabular-nums">{{ chosen[o.id] ?? 0 }}</span>
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  :disabled="!!g.maxQuantity && timesIn(g) >= g.maxQuantity"
                  :aria-label="`Más ${o.name}`"
                  @click="step(g, o.id, 1)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full space-y-2">
        <p
          v-if="missing.length"
          class="text-sm text-warning"
        >
          Falta elegir: {{ missing.map(g => g.name).join(', ') }}
        </p>
        <UButton
          :label="`Agregar · ${money((product?.price ?? 0) + extra)}`"
          icon="i-lucide-plus"
          size="xl"
          block
          :disabled="missing.length > 0"
          @click="add"
        />
      </div>
    </template>
  </UModal>
</template>
