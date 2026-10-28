<script setup lang="ts">
import type { Customer } from '~/types/pos'

const open = defineModel<boolean>('open', { required: true })

const pos = usePos()
const toast = useToast()
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

// ---- New customer (FA-016): name and tax id (or CF), phone and address optional; also without internet
const company = computed(() => state.catalog?.company)
const taxIdLabel = computed(() => company.value?.taxIdLabel ?? 'NIT')
const finalConsumerTaxId = computed(() => state.catalog?.finalConsumer?.taxId ?? 'CF')
const creating = ref(false)
const form = reactive({ name: '', taxId: '', phone: '', address: '' })
const formError = ref<string | null>(null)
const saving = ref(false)

function startCreating() {
  const text = query.value.trim()
  // What was searched is probably the name, or the tax id
  const looksLikeTaxId = /\d/.test(text) && isValidTaxIdOf(company.value?.taxIdRule, text)
  Object.assign(form, { name: looksLikeTaxId ? '' : text, taxId: looksLikeTaxId ? text : '', phone: '', address: '' })
  formError.value = null
  creating.value = true
}

const isFinalConsumer = computed(() => isFinalConsumerTaxId(form.taxId, finalConsumerTaxId.value))
const taxIdInvalid = computed(() => !!form.taxId.trim() && !isFinalConsumer.value && !isValidTaxIdOf(company.value?.taxIdRule, form.taxId))
const phoneInvalid = computed(() => {
  const digits = form.phone.replace(/\D/g, '')
  return !!form.phone.trim() && (digits.length < (company.value?.phoneDigits ?? 8) || digits.length > 15)
})

async function save() {
  formError.value = null
  if (!form.name.trim()) {
    formError.value = 'Escribe el nombre del cliente.'
    return
  }
  if (!form.taxId.trim()) {
    formError.value = `Escribe el ${taxIdLabel.value}, o toca ${finalConsumerTaxId.value} si no tiene.`
    return
  }
  if (taxIdInvalid.value) {
    formError.value = `El ${taxIdLabel.value} no es válido. Revísalo o toca ${finalConsumerTaxId.value}.`
    return
  }
  if (phoneInvalid.value) {
    formError.value = 'El teléfono no parece completo.'
    return
  }
  saving.value = true
  try {
    const taxId = isFinalConsumer.value ? finalConsumerTaxId.value : normalizeTaxId(company.value?.taxIdRule, form.taxId)
    const { customer, existing } = await pos.createCustomer({ ...form, taxId })
    toast.add({
      title: existing ? `Ya existía: ${customer.name}` : `Cliente ${customer.name} creado`,
      description: existing
        ? `Falco ya tenía un cliente con ese ${isFinalConsumer.value ? 'teléfono' : taxIdLabel.value}; la venta queda a su nombre.`
        : customer.local ? 'Sin internet: llega a Falco con la venta.' : undefined,
      color: 'success',
      icon: 'i-lucide-user-check'
    })
    creating.value = false
    query.value = ''
    open.value = false
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

watch(open, (value) => {
  if (!value) {
    creating.value = false
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="creating ? 'Nuevo cliente' : 'Cliente'"
    :description="creating ? 'Queda elegido para esta venta.' : 'Sin elegir, la venta es a consumidor final.'"
  >
    <template #body>
      <form
        v-if="creating"
        class="space-y-3"
        @submit.prevent="save"
      >
        <UFormField
          label="Nombre"
          required
        >
          <UInput
            v-model="form.name"
            size="xl"
            class="w-full"
            :maxlength="200"
            autofocus
          />
        </UFormField>
        <UFormField
          :label="taxIdLabel"
          required
          :error="taxIdInvalid ? `No es un ${taxIdLabel} válido` : undefined"
        >
          <div class="flex gap-2">
            <UInput
              v-model="form.taxId"
              size="xl"
              class="flex-1"
              :maxlength="20"
              :placeholder="company?.taxIdRule === 'NIT_GT' ? '1234567-9' : undefined"
            />
            <UButton
              :label="finalConsumerTaxId"
              size="xl"
              :color="isFinalConsumer ? 'primary' : 'neutral'"
              :variant="isFinalConsumer ? 'soft' : 'outline'"
              @click="form.taxId = finalConsumerTaxId"
            />
          </div>
        </UFormField>
        <UFormField
          label="Teléfono"
          :help="isFinalConsumer ? `Opcional. Con ${finalConsumerTaxId}, si ya hay un cliente con este teléfono se usa ese.` : 'Opcional.'"
          :error="phoneInvalid ? 'El teléfono no parece completo' : undefined"
        >
          <UInput
            v-model="form.phone"
            type="tel"
            inputmode="tel"
            size="xl"
            class="w-full"
            :maxlength="50"
          />
        </UFormField>
        <UFormField
          label="Dirección"
          help="Opcional."
        >
          <UInput
            v-model="form.address"
            size="xl"
            class="w-full"
            :maxlength="300"
          />
        </UFormField>
        <UAlert
          v-if="!state.online"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          description="Sin internet: el cliente queda en este dispositivo y llega a Falco con la venta."
        />
        <p
          v-if="formError"
          class="text-sm text-error"
        >
          {{ formError }}
        </p>
        <div class="flex gap-2">
          <UButton
            label="Volver"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="creating = false"
          />
          <UButton
            type="submit"
            label="Crear y elegir"
            icon="i-lucide-user-plus"
            size="xl"
            block
            class="flex-1"
            :loading="saving"
          />
        </div>
      </form>

      <div
        v-else
        class="space-y-3"
      >
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
        <UInput
          v-model="query"
          icon="i-lucide-search"
          :placeholder="state.online ? `Nombre, código o ${taxIdLabel}` : 'Clientes creados en este dispositivo'"
          size="xl"
          class="w-full"
          :loading="searching"
          autofocus
        />
        <UAlert
          v-if="!state.online"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          description="Sin internet solo se buscan los clientes creados en este dispositivo. Puedes crear uno nuevo."
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
          :description="[customer.code, customer.taxId, customer.phone, customer.local ? 'por enviar' : null].filter(Boolean).join(' · ')"
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
          No hay clientes con "{{ query.trim() }}".
        </p>
        <UButton
          label="Nuevo cliente"
          icon="i-lucide-user-plus"
          color="neutral"
          variant="soft"
          size="lg"
          block
          @click="startCreating"
        />
      </div>
    </template>
  </UModal>
</template>
