/** Signed in first, then a terminal with its catalog on this device; then the POS sells. */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  if (to.path === '/login') {
    return
  }
  if (!auth.signedIn.value) {
    return navigateTo('/login')
  }
  const pos = usePos()
  await pos.load()
  if ((!pos.state.setup || !pos.state.catalog) && !['/terminal', '/ajustes'].includes(to.path)) {
    return navigateTo('/terminal')
  }
})
