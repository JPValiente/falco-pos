<script setup lang="ts">
const env = useRuntimeConfig().public.appEnv
const prefix = env && env !== 'production' ? `[${env}] ` : ''
const { browserTicket, settings } = usePrinter()

// The company's color, as chosen in Falco; it comes with the catalog, so it stays without internet
const appConfig = useAppConfig()
const { state } = usePos()
watch(() => state.catalog?.company.brandColor, (color) => {
  appConfig.ui.colors.primary = brandColorOf(color)
}, { immediate: true })

useHead({
  titleTemplate: title => `${prefix}${title ? `${title} · Falco POS` : 'Falco POS'}`
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Only on paper, when the browser prints the ticket (see assets/css/main.css) -->
    <pre
      class="falco-ticket"
      :style="{ width: `${settings.paper}mm`, fontSize: '9px' }"
    >{{ browserTicket }}</pre>
  </UApp>
</template>
