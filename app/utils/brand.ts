/** Palettes a company may choose in Falco (the same list as the backend); "green" is Falco's. */
const BRAND_COLORS = ['green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange']

/** The color of buttons, links and highlights; unknown or missing values fall back to Falco's green. */
export function brandColorOf(color: string | null | undefined): string {
  return color && BRAND_COLORS.includes(color) ? color : 'green'
}
