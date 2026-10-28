<script setup lang="ts">
import type { TenantSelection } from '~/types/pos'

definePageMeta({ layout: false })
useHead({ title: 'Iniciar sesión' })

const auth = useAuth()
const pos = usePos()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const selection = ref<TenantSelection | null>(null)

/** With the session open: may this person sell here, and is this device theirs to use? */
async function enter() {
  const denied = await pos.checkAccess()
  if (denied) {
    await auth.logout()
    throw new Error(denied)
  }
  const blocked = await pos.adoptTenant(auth.session.value!.tenantId!)
  if (blocked) {
    await auth.logout()
    throw new Error(blocked)
  }
  pos.state.needsLogin = false
  if (pos.state.setup) {
    // The catalog says who sells and what they may do; a 403 means this terminal is not theirs
    try {
      await pos.downloadCatalog()
    } catch (e) {
      if (statusOf(e) === 403) {
        await auth.logout()
      }
      throw e
    }
    pos.sync()
    await navigateTo('/')
  } else {
    await navigateTo('/terminal')
  }
}

async function run(action: () => Promise<void>) {
  loading.value = true
  error.value = null
  try {
    await action()
  } catch (e) {
    error.value = statusOf(e) || !(e instanceof Error) ? errorMessage(e) : e.message
  } finally {
    loading.value = false
  }
}

const login = () => run(async () => {
  selection.value = await auth.login(username.value.trim(), password.value)
  if (!selection.value) {
    await enter()
  }
})

const choose = (tenantId: string) => run(async () => {
  await auth.selectTenant(selection.value!.selectionToken, tenantId)
  selection.value = null
  await enter()
})
</script>

<template>
  <div class="falco-page flex min-h-dvh items-center justify-center p-4">
    <div class="falco-card w-full max-w-sm space-y-6 p-6">
      <div class="space-y-2 text-center">
        <AppMark
          class="mx-auto h-10 w-auto text-primary"
          aria-label="Falco"
        />
        <h1 class="text-xl font-bold text-highlighted">
          Punto de venta
        </h1>
        <p class="text-sm text-muted">
          Entra con tu usuario de Falco.
        </p>
      </div>

      <UAlert
        v-if="pos.state.needsLogin && pos.pending.value"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-upload"
        :title="`Hay ${pos.pending.value} pendientes de enviar`"
        description="Se envían en cuanto vuelvas a entrar."
      />
      <UAlert
        v-else-if="pos.state.shift && pos.state.setup"
        color="info"
        variant="subtle"
        icon="i-lucide-users"
        :title="`Turno ${pos.state.shift.number} abierto en ${pos.state.setup.terminal.name}`"
        description="Entra con tu usuario para seguir vendiendo en el mismo turno."
      />
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="error"
      />

      <div
        v-if="selection"
        class="space-y-2"
      >
        <p class="text-sm font-medium text-highlighted">
          ¿En qué empresa vas a vender?
        </p>
        <UButton
          v-for="tenant in selection.tenants"
          :key="tenant.tenantId"
          :label="tenant.name"
          :description="tenant.role"
          color="neutral"
          variant="outline"
          block
          size="lg"
          :loading="loading"
          class="justify-start"
          @click="choose(tenant.tenantId)"
        />
        <UButton
          label="Volver"
          color="neutral"
          variant="ghost"
          block
          @click="selection = null"
        />
      </div>

      <form
        v-else
        class="space-y-4"
        @submit.prevent="login"
      >
        <UFormField label="Usuario o correo">
          <UInput
            v-model="username"
            autocomplete="username"
            size="xl"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="Contraseña">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            size="xl"
            class="w-full"
            required
          />
        </UFormField>
        <UButton
          type="submit"
          label="Entrar"
          size="xl"
          block
          :loading="loading"
        />
      </form>
    </div>
  </div>
</template>
