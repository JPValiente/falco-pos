<script setup lang="ts">
/**
 * The bell ("campanita"): stock of this point of sale's warehouse that needs attention, such as a
 * supply of the coffee that ran out. It goes away by itself once the stock is back in Falco.
 */
const pos = usePos()
const { state } = pos
const open = ref(false)
const SEEN_KEY = 'falco_pos_seen_alerts'
const seen = ref<string[]>([])
onMounted(() => {
  try {
    seen.value = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    seen.value = []
  }
})
const unseen = computed(() => state.alerts.filter(a => !seen.value.includes(a.key)).length)
watch(open, (value) => {
  if (value) {
    pos.refreshAlerts()
    seen.value = state.alerts.map(a => a.key)
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.value))
    } catch {
      // Private window: the dot comes back next time
    }
  }
})
const items = computed(() => state.alerts.map(a => ({ ...a, ...stockAlertText(a) })))
</script>

<template>
  <UChip
    :show="unseen > 0"
    color="error"
    inset
  >
    <UButton
      icon="i-lucide-bell"
      color="neutral"
      variant="ghost"
      :aria-label="state.alerts.length ? `Notificaciones: ${state.alerts.length}` : 'Notificaciones'"
      @click="open = true"
    />
  </UChip>
  <USlideover
    v-model:open="open"
    title="Notificaciones"
    :description="`Existencias de ${state.setup?.terminal.warehouse?.name ?? 'la bodega'} que necesitan atención. Desaparecen solas al reponerlas en Falco.`"
  >
    <template #body>
      <UEmpty
        v-if="!items.length"
        icon="i-lucide-bell-off"
        title="Todo en orden"
        description="Nada agotado ni en negativo en la bodega de este punto de venta."
      />
      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="item in items"
          :key="item.key"
          class="flex gap-3 rounded-lg border border-default p-3"
        >
          <UIcon
            :name="item.icon"
            class="mt-0.5 size-5 shrink-0"
            :class="item.color === 'error' ? 'text-error' : 'text-warning'"
          />
          <span class="min-w-0">
            <span class="block font-medium text-highlighted">{{ item.title }}</span>
            <span class="block text-sm text-muted">{{ item.description }}</span>
          </span>
        </li>
      </ul>
      <p
        v-if="!state.online"
        class="mt-3 text-xs text-muted"
      >
        Sin internet: es lo último que dijo Falco.
      </p>
    </template>
  </USlideover>
</template>
