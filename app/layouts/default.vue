<script setup lang="ts">
const pos = usePos()
const route = useRoute()
const { state, pending } = pos

const links = [
  { to: '/', label: 'Vender', icon: 'i-lucide-shopping-cart' },
  { to: '/turno', label: 'Turno', icon: 'i-lucide-calculator' },
  { to: '/cortes', label: 'Cortes', icon: 'i-lucide-receipt-text' },
  { to: '/ajustes', label: 'Ajustes', icon: 'i-lucide-settings' }
]

/** Online and up to date, sending, waiting for internet, or something Falco did not take. */
const status = computed(() => {
  if (state.needsLogin) {
    return { label: 'Inicia sesión', icon: 'i-lucide-log-in', color: 'error' as const }
  }
  if (!state.online) {
    return { label: pending.value ? `Sin internet · ${pending.value}` : 'Sin internet', icon: 'i-lucide-wifi-off', color: 'warning' as const }
  }
  if (state.syncing) {
    return { label: 'Enviando…', icon: 'i-lucide-refresh-cw', color: 'info' as const }
  }
  if (pending.value) {
    return { label: `${pending.value} por enviar`, icon: 'i-lucide-cloud-upload', color: 'warning' as const }
  }
  return { label: 'Al día', icon: 'i-lucide-cloud-check', color: 'success' as const }
})
</script>

<template>
  <div class="flex h-dvh flex-col">
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-default bg-default px-3 sm:px-4">
      <AppMark
        class="h-6 w-auto shrink-0 text-primary"
        aria-label="Falco"
      />
      <div class="min-w-0 flex-1 leading-tight">
        <p class="truncate text-sm font-semibold text-highlighted">
          {{ state.setup?.terminal.name ?? 'Punto de venta' }}
        </p>
        <p
          v-if="state.catalog"
          class="truncate text-xs text-muted"
        >
          {{ state.catalog.company.name }} · {{ state.catalog.seller.name }}
        </p>
      </div>
      <PosBell v-if="state.setup" />
      <UButton
        :label="status.label"
        :icon="status.icon"
        :color="status.color"
        variant="soft"
        size="sm"
        :loading="state.syncing"
        :to="state.needsLogin ? '/login' : '/ajustes'"
      />
      <nav class="hidden gap-1 md:flex">
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :label="link.label"
          :icon="link.icon"
          :color="route.path === link.to ? 'primary' : 'neutral'"
          :variant="route.path === link.to ? 'soft' : 'ghost'"
        />
      </nav>
    </header>

    <main class="falco-page min-h-0 flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- Phones: the sections at the bottom, within reach of the thumb -->
    <nav class="grid shrink-0 grid-cols-4 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] md:hidden">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex flex-col items-center gap-0.5 py-2 text-xs font-medium"
        :class="route.path === link.to ? 'text-primary' : 'text-muted'"
      >
        <UIcon
          :name="link.icon"
          class="size-6"
        />
        {{ link.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
