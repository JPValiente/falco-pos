<script setup lang="ts">
import type { Station } from '~/types/pos'

const open = defineModel<boolean>('open', { required: true })

const pos = usePos()
const { state, money } = pos
const rate = computed(() => state.catalog?.tax.rate ?? 0)
const includes = computed(() => state.catalog?.tax.pricesIncludeTax ?? false)

/** The stations of the terminal by zone, as the administrator set them up in Falco. */
const zones = computed(() => {
  const groups = new Map<string, Station[]>()
  for (const station of (state.setup?.terminal.stations ?? []).filter(s => s.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
    const zone = station.zone || 'Sin zona'
    groups.set(zone, [...(groups.get(zone) ?? []), station])
  }
  return [...groups.entries()]
})

const accountOf = (stationId: string) => state.accounts.find(a => a.stationId === stationId)

async function choose(stationId: string | null) {
  await pos.selectStation(stationId)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cuentas"
    description="Cada mesa o lugar lleva su cuenta abierta hasta cobrarla."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UButton
          label="Venta directa (sin cuenta)"
          icon="i-lucide-shopping-bag"
          :color="!state.stationId ? 'primary' : 'neutral'"
          :variant="!state.stationId ? 'soft' : 'outline'"
          size="lg"
          block
          @click="choose(null)"
        />
        <UEmpty
          v-if="!zones.length"
          icon="i-lucide-armchair"
          title="Este punto de venta no tiene mesas"
          description="El administrador las agrega en Falco, en Punto de venta."
        />
        <section
          v-for="[zone, stations] in zones"
          :key="zone"
          class="space-y-2"
        >
          <h3 class="text-sm font-semibold text-muted">
            {{ zone }}
          </h3>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="station in stations"
              :key="station.id"
              type="button"
              class="rounded-xl border p-3 text-left transition"
              :class="[
                station.id === state.stationId ? 'ring-2 ring-primary' : '',
                accountOf(station.id) ? 'border-primary/40 bg-primary/10' : 'border-default bg-default hover:bg-elevated/50'
              ]"
              @click="choose(station.id)"
            >
              <p class="font-semibold text-highlighted">
                {{ station.name }}
              </p>
              <p
                v-if="accountOf(station.id)"
                class="text-sm text-primary tabular-nums"
              >
                {{ money(totals(accountOf(station.id)!.lines, rate, includes).total) }}
              </p>
              <p
                v-else
                class="text-sm text-muted"
              >
                Libre
              </p>
            </button>
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>
