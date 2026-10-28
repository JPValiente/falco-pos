/**
 * Loads what the device keeps, sends what is pending, and installs the service worker that keeps
 * the POS available without internet (only in a build: in development it would serve stale files).
 */
export default defineNuxtPlugin(async () => {
  const pos = usePos()
  await pos.load()
  pos.sync()

  if (!import.meta.dev && 'serviceWorker' in navigator) {
    const buildId = useRuntimeConfig().app.buildId
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId)}`).catch(() => {})
  }
})
