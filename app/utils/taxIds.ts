/**
 * Tax ids checked on the device, without internet (FA-016), by the rule of the company's country: the
 * same rules as `TaxIdRule` in falco-core and `utils/taxIds.ts` in the ERP.
 */
export type TaxIdRule = 'NIT_GT' | 'RFC_MX' | 'NIT_SV' | 'RTN_HN' | 'FORMAT'

const RFC_FORMAT = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{2}[\dA]$/
const RFC_VALUES = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ'
const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000']
const ANY_TAX_ID = /^[A-Z0-9Ñ&-]{5,20}$/

const compact = (value: string) => value.replace(/[\s-]/g, '').toUpperCase()
const digitsOf = (value: string) => value.replace(/[\s-]/g, '')

function isValidNit(value: string): boolean {
  const nit = compact(value)
  if (!/^\d+[\dK]$/.test(nit) || nit.length < 2) {
    return false
  }
  const digits = nit.slice(0, -1)
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * (i + 2)
  }
  const check = (11 - (sum % 11)) % 11
  return nit.at(-1) === (check === 10 ? 'K' : String(check))
}

function validDate(yymmdd: string): boolean {
  const [y, m, d] = [yymmdd.slice(0, 2), yymmdd.slice(2, 4), yymmdd.slice(4, 6)].map(Number)
  const date = new Date(2000 + y!, m! - 1, d!)
  return date.getMonth() === m! - 1 && date.getDate() === d
}

function isValidRfc(value: string): boolean {
  const rfc = compact(value)
  if (GENERIC_RFCS.includes(rfc)) {
    return true
  }
  if (!RFC_FORMAT.test(rfc)) {
    return false
  }
  const letters = rfc.length - 9
  const withoutDigit = rfc.slice(0, -1)
  const base = withoutDigit.length === 11 ? ` ${withoutDigit}` : withoutDigit
  let sum = 0
  for (let i = 0; i < base.length; i++) {
    sum += RFC_VALUES.indexOf(base[i]!) * (13 - i)
  }
  const remainder = sum % 11
  const digit = remainder === 0 ? '0' : 11 - remainder === 10 ? 'A' : String(11 - remainder)
  return validDate(rfc.slice(letters, letters + 6)) && digit === rfc.at(-1)
}

function isValidDui(value: string): boolean {
  const digits = digitsOf(value)
  if (!/^\d{9}$/.test(digits)) {
    return false
  }
  const sum = [...digits.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0)
  return (10 - (sum % 10)) % 10 === Number(digits[8])
}

function isValidSvNit(value: string): boolean {
  const digits = digitsOf(value)
  if (digits.length === 9) {
    return isValidDui(digits)
  }
  if (!/^\d{14}$/.test(digits)) {
    return false
  }
  const old = Number(digits.slice(10, 13)) <= 100
  const weights = old ? [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] : [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((s, w, i) => s + Number(digits[i]) * w, 0)
  const check = old ? (sum % 11) % 10 : (((-sum % 11) + 11) % 11) % 10
  return check === Number(digits[13])
}

function isValidRtn(value: string): boolean {
  const digits = digitsOf(value)
  const department = Number(digits.slice(0, 2))
  return /^\d{14}$/.test(digits) && department >= 1 && department <= 18
}

export function isValidTaxIdOf(rule: TaxIdRule | undefined, value: string): boolean {
  switch (rule) {
    case 'NIT_GT': return isValidNit(value)
    case 'RFC_MX': return isValidRfc(value)
    case 'NIT_SV': return isValidSvNit(value)
    case 'RTN_HN': return isValidRtn(value)
    default: return ANY_TAX_ID.test(value.replace(/\s/g, '').toUpperCase())
  }
}

/** As Falco stores it: "1234567-9", "EKU9003173C9", "0614-050707-104-8"... */
export function normalizeTaxId(rule: TaxIdRule | undefined, value: string): string {
  const digits = digitsOf(value)
  switch (rule) {
    case 'NIT_GT': {
      const nit = compact(value)
      return `${nit.slice(0, -1)}-${nit.slice(-1)}`
    }
    case 'RFC_MX': return compact(value)
    case 'NIT_SV': return digits.length === 14
      ? `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits[13]}`
      : digits.length === 9 ? `${digits.slice(0, 8)}-${digits[8]}` : digits
    case 'RTN_HN': return digits.length === 14 ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}` : digits
    default: return value.replace(/\s/g, '').toUpperCase()
  }
}

/** "CF", also as "C/F" or "c.f.", against the country's final consumer tax id. */
export function isFinalConsumerTaxId(value: string, finalConsumerTaxId: string | null | undefined): boolean {
  const strip = (v: string) => v.trim().toUpperCase().replace(/[\s./-]/g, '')
  return !!finalConsumerTaxId && strip(value) === strip(finalConsumerTaxId)
}
