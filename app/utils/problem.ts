interface FetchLikeError {
  response?: { status?: number, _data?: { detail?: string, title?: string } }
}

/** HTTP status of a failed call; null when Falco did not answer (no internet). */
export function statusOf(error: unknown): number | null {
  return (error as FetchLikeError | null)?.response?.status ?? null
}

/** User-facing message for a failed call to Falco. */
export function errorMessage(error: unknown): string {
  const response = (error as FetchLikeError | null)?.response
  if (!response?.status) {
    return 'No se pudo conectar con Falco. Revisa el internet.'
  }
  return response._data?.detail ?? response._data?.title ?? `Error ${response.status}`
}
