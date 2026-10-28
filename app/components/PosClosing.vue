<script setup lang="ts">
import type { ShiftClosing } from '~/types/pos'

/** A corte de caja: what was sold by method and the cash that should be (and was) in the drawer. */
defineProps<{ closing: ShiftClosing, openingFloat: number, counted?: boolean }>()

const { money } = usePos()
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-2">
      <div class="falco-card p-3">
        <p class="text-xs text-muted">
          Ventas ({{ closing.salesCount }})
        </p>
        <p class="text-lg font-bold text-highlighted tabular-nums">
          {{ money(closing.salesTotal) }}
        </p>
      </div>
      <div class="falco-card p-3">
        <p class="text-xs text-muted">
          Efectivo esperado
        </p>
        <p class="text-lg font-bold text-highlighted tabular-nums">
          {{ money(closing.expectedCash) }}
        </p>
      </div>
    </div>
    <dl class="falco-card divide-y divide-default text-sm">
      <div class="flex justify-between p-3">
        <dt>Fondo inicial</dt><dd class="tabular-nums">
          {{ money(openingFloat) }}
        </dd>
      </div>
      <div class="flex justify-between p-3">
        <dt>Efectivo (ya sin vuelto)</dt><dd class="tabular-nums">
          {{ money(closing.cashTotal) }}
        </dd>
      </div>
      <div class="flex justify-between p-3">
        <dt>Transferencia</dt><dd class="tabular-nums">
          {{ money(closing.transferTotal) }}
        </dd>
      </div>
      <div class="flex justify-between p-3">
        <dt>Tarjeta</dt><dd class="tabular-nums">
          {{ money(closing.cardTotal) }}
        </dd>
      </div>
      <template v-if="counted">
        <div class="flex justify-between p-3">
          <dt>Efectivo contado</dt><dd class="tabular-nums">
            {{ money(closing.countedCash) }}
          </dd>
        </div>
        <div class="flex justify-between p-3 font-semibold">
          <dt>{{ closing.difference < 0 ? 'Faltante' : closing.difference > 0 ? 'Sobrante' : 'Cuadra' }}</dt>
          <dd
            class="tabular-nums"
            :class="closing.difference < 0 ? 'text-error' : closing.difference > 0 ? 'text-warning' : 'text-success'"
          >
            {{ money(closing.difference) }}
          </dd>
        </div>
      </template>
    </dl>
    <p
      v-if="counted && closing.notes"
      class="text-sm text-muted"
    >
      Nota: {{ closing.notes }}
    </p>
  </div>
</template>
