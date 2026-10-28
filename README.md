# Falco POS

El punto de venta de Falco. Funciona en teléfonos, tabletas y computadoras, y vende aunque no haya internet. Las ventas, los turnos y los cortes de caja llegan solos a Falco (falco-core) cuando vuelve la conexión.

Usa Nuxt 4 y Nuxt UI, igual que el ERP (falco-frontend). Es una app estática, sin servidor (`ssr: false`), que se instala como app (PWA).

## Cómo funciona

1. **Entrar.** El vendedor entra con su usuario de Falco. La empresa necesita el módulo **POS** y el usuario el permiso **Vender en POS** (`pos.sell`); los administradores lo tienen siempre.
2. **Punto de venta.** El dispositivo toma uno de los puntos de venta creados en el ERP (*Punto de venta*) y descarga el catálogo: productos vendibles de la bodega del punto de venta con precio y existencia, categorías, impuesto y consumidor final.
   - Si otro dispositivo tenía ese punto de venta, este se lo queda. El anterior puede enviar lo que tenga pendiente.
   - La numeración continúa desde lo último que Falco recibió.
3. **Turno.** Se abre con el fondo inicial de efectivo. Se cierra con el efectivo contado, y el corte (esperado, contado y diferencia) queda fijo.
4. **Vender.**
   - Productos por categoría o por búsqueda.
   - Cantidades y descuentos (solo con el permiso `pos.discount`).
   - Cliente opcional: consumidor final por defecto; buscar clientes necesita internet.
   - Cobro en efectivo, transferencia o tarjeta, o mezclados, con cálculo del vuelto.
   - Nunca se deja de vender: si la existencia se acaba, la venta se registra igual y el ERP avisa en el tablero ("Existencia negativa").
   - **Preparación instantánea** (una hamburguesa, un licuado, un café): el producto no tiene existencia propia; al venderlo salen sus insumos de la bodega del punto de venta. El catálogo trae la receta, así que las tarjetas de los insumos bajan al momento, también sin internet.
   - **Opciones** (extras, término, tipo de leche): al tocar un producto que las tiene, se eligen antes de agregarlo y no deja agregarlo sin las obligatorias. Lo que suman va en el precio de la línea, el ticket las muestra y las existencias de la tarjeta toman en cuenta lo que agregan, cambian o quitan. El mismo producto con otras opciones es otra línea.
   - **Campanita:** avisa de lo que está en negativo, agotado o bajo el mínimo en la bodega del punto de venta. Se actualiza al descargar el catálogo y después de cada envío; el punto rojo indica avisos no vistos en este dispositivo.
5. **Cuentas abiertas.** Solo en puntos de venta con "Cuentas abiertas (restaurantes)" activado.
   - Cada mesa o lugar, configurado en el ERP, lleva su cuenta hasta cobrarla.
   - Las cuentas viven en el dispositivo.
6. **Ticket.**
   - Impresora térmica Bluetooth (ESC/POS) desde Chrome en Android o en computadora.
   - En iPhone, o con impresoras de la computadora, se imprime con el navegador.
   - Papel de 58 u 80 mm. Imprimir o no se recuerda por dispositivo y se puede cambiar en cada venta.
   - Se reimprime desde *Cortes*.
   - El ticket **no es factura electrónica**.

### Sin internet

- **Dónde se guarda:** todo queda en el dispositivo (IndexedDB), es decir catálogo, turnos, ventas y cuentas.
- **Cuándo se envía:** al recuperar la conexión, cada minuto y con *Ajustes → Enviar ahora*.
- **Sin duplicados:** cada venta y turno tiene un identificador propio, así que Falco no los registra dos veces aunque se envíen de nuevo.
- **Sesión:** puede estar sin internet hasta **7 días**, lo que dura la sesión. Si vence, se vuelve a entrar y lo pendiente se envía; no se pierde nada.
- **App sin conexión:** el service worker (`public/sw.js`) guarda la app. La lista de archivos, `precache.json`, la genera `scripts/precache.mjs` al compilar.

### Datos y sesión

- Las ventas ya enviadas se guardan 30 días en el dispositivo para los cortes y las reimpresiones.
- No se puede cambiar de punto de venta con un turno abierto o con ventas sin enviar.
- **Cambiar de vendedor** (Ajustes o Turno) sí se puede con el turno abierto, pero necesita internet: el siguiente entra con su usuario de Falco. Cada ticket guarda quién lo vendió y el corte muestra las ventas por vendedor.
- **Usuarios asignados:** cada punto de venta puede tener sus usuarios (en el ERP, *Punto de venta → Usuarios*). Sin usuarios lo usa cualquiera con "Vender en POS"; los administradores y quien tiene "Administrar POS" usan todos. Si al vendedor le quitan el punto de venta, lo que vendió se recibe igual y el POS deja de vender con él al volver a conectarse.
- Si entra otra empresa en el mismo dispositivo, los datos de la anterior se borran, pero solo si no tiene nada pendiente.

## Desarrollo

```bash
pnpm install
cp .env.example .env   # NUXT_PUBLIC_API_BASE apunta a falco-core
pnpm dev               # http://localhost:3300
pnpm lint
pnpm typecheck
```

falco-core debe permitir el origen del POS en `CORS_ORIGINS`, por ejemplo `http://localhost:3300`. En el ERP, `NUXT_PUBLIC_POS_URL` hace que aparezca el botón "Abrir el POS".

## Publicar

```bash
NUXT_PUBLIC_API_BASE=https://api.ejemplo.com/api/v1 NUXT_PUBLIC_APP_ENV=production pnpm build
```

- **Cómo servir el resultado:** `.output/public` es un sitio estático. Cualquier hosting estático sirve (Cloudflare Pages, Netlify, Nginx).
- **Rutas:** todas deben responder con `index.html` (o `200.html`).
- **HTTPS:** es obligatorio para el service worker y para el Bluetooth.
- **Configuración por entorno:** las variables quedan fijas al compilar, así que cada entorno (QA, producción) se compila por separado.
