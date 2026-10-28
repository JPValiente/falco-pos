<script setup lang="ts">
import type { Customer } from '~/types/pos'

const open = defineModel<boolean>('open', { required: true })

const pos = usePos()
const { state } = pos
const query = ref('')
const results = ref<Customer[]>([])
const searching = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

watch(query, (value) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => search(value), 300)
})

async function search(value: string) {
  if (value.trim().length < 2) {
    results.value = []
    return
  }
  searching.value = true
  error.value = null
  try {
    results.value = await pos.searchCustomers(value.trim())
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    searching.value = false
  }
}

function choose(customer: Customer | null) {
  pos.setCustomer(customer)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cliente"
    description="Sin elegir, la venta es a consumidor final."
  >
    <template #body>
      <div class="space-y-3">
        <UButton
          :label="state.catalog?.finalConsumer.name ?? 'Consumidor final'"
          icon="i-lucide-user"
          :color="!state.customer ? 'primary' : 'neutral'"
          :variant="!state.customer ? 'soft' : 'outline'"
          size="lg"
          block
          class="justify-start"
          @click="choose(null)"
        />
        <UAlert
          v-if="!state.online"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          description="Sin internet solo se vende a consumidor final. Buscar clientes necesita conexión."
        />
        <template v-else>
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Nombre, código o NIT"
            size="xl"
            class="w-full"
            :loading="searching"
            autofocus
          />
          <p
            v-if="error"
            class="text-sm text-error"
          >
            {{ error }}
          </p>
          <UButton
            v-for="customer in results"
            :key="customer.id"
            :label="customer.name"
            :description="[customer.code, customer.taxId].filter(Boolean).join(' · ')"
            :color="state.customer?.id === customer.id ? 'primary' : 'neutral'"
            variant="outline"
            size="lg"
            block
            class="justify-start"
            @click="choose(customer)"
          />
          <p
            v-if="query.trim().length >= 2 && !searching && !results.length && !error"
            class="text-center text-sm text-muted"
          >
            No hay clientes con "{{ query.trim() }}". Los clientes se crean en Falco.
          </p>
        </template>
      </div>
    </template>
  </UModal>
</template>
