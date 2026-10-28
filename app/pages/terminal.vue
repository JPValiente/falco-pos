<script setup lang="ts">
import type { Terminal } from '~/types/pos'

useHead({ title: 'Punto de venta' })

const pos = usePos()
const toast = useToast()
const { state } = pos
const { data: terminals, status, error, refresh } = useAsyncData('terminals', () => pos.terminals())
const selected = ref<string | null>(state.setup?.terminal.id ?? null)
const deviceName = ref(state.setup?.deviceName ?? guessDevice())
const claiming = ref(false)

// The one there is, or the one this device had if it is still on the list
watch(terminals, (list) => {
  if (!list?.some(t => t.id === selected.value)) {
    selected.value = list?.length === 1 ? list[0]!.id : null
  }
}, { immediate: true })

function guessDevice() {
  const agent = navigator.userAgent
  if (/iPhone/.test(agent)) return 'iPhone'
  if (/iPad/.test(agent)) return 'iPad'
  if (/Android/.test(agent)) return /Mobile/.test(agent) ? 'Teléfono Android' : 'Tableta Android'
  return 'Computadora'
}

async function claim(terminal: Terminal) {
  claiming.value = true
  try {
    const result = await pos.claim(terminal, deviceName.value.trim() || guessDevice())
    if (result.previousDevice && result.previousDevice !== deviceName.value.trim()) {
      toast.add({
        color: 'warning',
        icon: 'i-lucide-smartphone',
        title: `Este dispositivo tomó ${terminal.name}`,
        description: `Lo tenía "${result.previousDevice}". Las ventas que aún tenga se envían igual.`
      })
    }
    await navigateTo('/')
  } catch (e) {
    toast.add({ color: 'error', icon: 'i-lucide-circle-alert', title: 'No se pudo tomar el punto de venta', description: statusOf(e) || !(e instanceof Error) ? errorMessage(e) : e.message })
  } finally {
    claiming.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4 p-4">
    <div>
      <h1 class="text-lg font-bold text-highlighted">
        ¿Qué punto de venta es este dispositivo?
      </h1>
      <p class="text-sm text-muted">
        Vende con el inventario de la bodega del punto de venta. Un punto de venta se usa en un dispositivo a la vez.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="No se pudieron cargar los puntos de venta"
      :description="errorMessage(error)"
      :actions="[{ label: 'Reintentar', onClick: () => { refresh() } }]"
    />
    <div
      v-else-if="status === 'pending'"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full rounded-xl"
      />
    </div>
    <UEmpty
      v-else-if="!terminals?.length"
      icon="i-lucide-monitor-smartphone"
      title="No tienes puntos de venta"
      description="Puede que aún no existan o que no tengas ninguno asignado. Pídeselo al administrador: los crea y asigna en Falco, en Punto de venta."
      class="falco-card"
    />
    <template v-else>
      <div class="space-y-2">
        <button
          v-for="terminal in terminals"
          :key="terminal.id"
          type="button"
          class="falco-card flex w-full items-center gap-3 p-4 text-left transition"
          :class="selected === terminal.id ? 'ring-2 ring-primary' : 'hover:bg-elevated/50'"
          @click="selected = terminal.id"
        >
          <UIcon
            name="i-lucide-monitor-smartphone"
            class="size-7 text-primary"
          />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">
              {{ terminal.name }} <span class="font-mono text-xs text-muted">{{ terminal.code }}</span>
            </p>
            <p class="text-sm text-muted">
              {{ terminal.warehouse?.name }}
              <template v-if="terminal.deviceName">
                · En uso en "{{ terminal.deviceName }}"
              </template>
            </p>
          </div>
          <UIcon
            v-if="selected === terminal.id"
            name="i-lucide-circle-check"
            class="size-6 text-primary"
          />
        </button>
      </div>
      <UFormField
        label="Nombre de este dispositivo"
        hint="Para reconocerlo en Falco"
      >
        <UInput
          v-model="deviceName"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UButton
        :label="selected ? 'Usar este punto de venta' : 'Elige un punto de venta de la lista'"
        size="xl"
        block
        :disabled="!selected"
        :loading="claiming"
        @click="claim(terminals.find(t => t.id === selected)!)"
      />
    </template>
  </div>
</template>
