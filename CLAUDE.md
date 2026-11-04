# falco-pos

Punto de venta de Falco: Nuxt 4, Nuxt UI 4, pnpm, app estática (`ssr: false`) e instalable (PWA). Lee también @../Falco-docs/CLAUDE.md

## Comandos

- `pnpm lint` y `pnpm typecheck`: los dos deben pasar antes de decir que terminaste.
- Para ver la app, usa `python3 ../Falco-docs/scripts/e2e.py front falco-pos <carpeta-temporal>`, no `pnpm dev`.

## Arquitectura

- `app/composables/usePos.ts`: terminal, catálogo, turno, carrito, cuentas y envío de ventas. Todo se guarda en el dispositivo (`app/utils/db.ts`).
- Lo que el POS necesita de la empresa llega en el **catálogo** de `falco-core` (`PosDtos.Catalog`), que se descarga al entrar, al tomar la terminal y desde Ajustes.

## Convenciones

- **Debe vender sin internet.** Lo nuevo tiene que funcionar con el catálogo guardado o decir con claridad que necesita conexión.
- **Nunca se deja de vender:** lo vendido sin conexión se acepta siempre al sincronizar.
- Un dispositivo puede tener un catálogo viejo: los campos nuevos son opcionales en `types/pos.ts` y tienen un valor por defecto.
- Interfaz para el teléfono: botones de 44 px o más, y una venta simple en 3 toques o menos.

## Lo que Claude suele hacer mal

- `pnpm -s` no existe en esta versión de pnpm.
- Suponer que un cambio en el ERP llega al POS al instante: llega cuando se vuelve a descargar el catálogo.
