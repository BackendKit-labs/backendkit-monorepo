# Building a Resilient Checkout in NestJS: Retry, Idempotency, and a System That Tunes Itself

> **Canonical URL:** https://backendkitlabs.dev/blog/resilient-checkout-nestjs
> **Status:** Ready to publish
> **Publication order:** Blog propio → Dev.to (canonical) → Medium (1 week later)

---

## The problem nobody talks about

You have a payment gateway. It fails sometimes. So you add a retry.

Now you have a worse problem: a customer clicks "Pay", the request reaches Stripe, the charge goes through, but the response never comes back. Your retry fires. Stripe charges them again.

That's not a hypothetical. It's the default behavior of any naive retry implementation, and it happens in production every day.

This post is about how we built a checkout system that handles this correctly — with retry that never double-charges, a circuit breaker that protects the service when the gateway is degraded, and a feedback loop that adjusts its own configuration under load. Then we stress-tested it with k6 and measured everything.

The code is in the [backendkit-monorepo shopify-backend example](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/shopify-backend).

---

## The architecture

The order flow is a typed pipeline of four steps:

```
POST /orders
  → ValidateInventoryStep     checks stock, reserves units
  → CalculatePricingStep      applies discounts, computes total
  → ChargePaymentStep         calls payment gateway with retry + idempotency
  → CreateOrderStep           persists order, emits events
```

Each step receives a typed `OrderContext`, returns `Result<OrderContext, OrderError>`, and the pipeline stops at the first failure. No exceptions, no try/catch chains — errors are values.

The payment step is where the interesting work happens:

```typescript
async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
  const result = await retry(
    async () => {
      const r = await this.client.post<ChargeResponse>('/charge', {
        orderId: ctx.orderId,
        amount: ctx.totalAmount,
        method: ctx.paymentMethod,
      });
      if (!r.ok) throw Object.assign(new Error(r.error.message), { status: r.error.status });
      return r.value.data;
    },
    {
      maxAttempts: 3,
      backoff: { type: 'exponential', baseDelay: 150, maxDelay: 2_000, jitter: 'full' },
      retryIf: { shouldRetry: (e) => e.type === 'http' && (e.status === 503 || e.status === 500) },
      idempotency: {
        enabled: true,
        key: `charge:${ctx.orderId}`,
        ttlMs: 24 * 60 * 60 * 1000,
      },
      hooks: {
        beforeRetry: ({ attempt, delayMs }) =>
          this.logger.warn(`Payment retry ${attempt} for order ${ctx.orderId} — waiting ${Math.round(delayMs)}ms`),
      },
    },
  );
  // ...
}
```

Three things to notice:
1. The `idempotency.key` is `charge:${ctx.orderId}` — unique per order, not per request. If the first attempt charges successfully but the response is lost, the retry hits the idempotency cache and returns the stored result. Stripe is never called again.
2. `retryIf` only retries on 500/503 — not on 400/422/404. Business errors don't retry.
3. `jitter: 'full'` randomizes the backoff delay to prevent thundering herd when multiple orders fail simultaneously.

---

## Test 1: The baseline — normal traffic

**Script:** `order-flow.k6.js` — ramps to 50 VUs over 2 minutes, full pipeline per iteration.

```
✓ success rate:    96.58%
✓ p95 latency:     2.03s
  avg latency:     1.17s
  throughput:      13.5 orders/second
  fail rate:       3.42%  (simulated gateway noise)
```

Under 50 concurrent users, the full pipeline — inventory check, pricing, payment, order creation — completes in 1.17 seconds on average. The 3.42% failure rate is the configured background noise of the payment simulator, not application errors.

This is the baseline. Every number that follows is measured against this.

---

## Test 2: What happens when the gateway degrades

**Script:** `circuit-breaker.k6.js` — sets `PAYMENT_FAILURE_RATE=0.8`, ramps to 30 VUs.

Without a circuit breaker, 80% failure rate means 80% of requests wait for the full gateway timeout before failing. With 30 VUs × 1-2 second timeout = threads exhaust, queue backs up, the entire service starts degrading — not just payments.

With a circuit breaker:

```
  health endpoint:       100% reachable throughout
  avg response time:     5.05ms
  fast-fail response:    ~5ms  (vs 1.17s baseline)
  http_req_failed:       49.99%
```

The `49.99%` failure rate splits exactly in half: health check requests (all succeed) and payment requests (circuit open, fast-fail). When the breaker trips, payment failures come back in **5 milliseconds** instead of waiting 1-2 seconds for a gateway that's known to be down.

The service never stopped responding. Health endpoints stayed at 100% throughout. The circuit breaker isolated the payment failure from the rest of the system.

---

## Test 3: Retry + idempotency under 60% failure rate

**Script:** `retry-idempotency.k6.js` — three concurrent scenarios, 60% gateway failure rate.

This is the scenario that matters most for e-commerce. A gateway failing 60% of the time is a degraded but not dead dependency — exactly when retry is most valuable and most dangerous.

```
  [retry_resilience]   success rate:      78.2%
  [retry_resilience]   retried requests:  825  with latency >500ms
  [idempotency_replay] replay rate:       100.0%
  [lifecycle]          correct cycles:    4/4
  p95 latency (with retries):             1345ms
```

**The math checks out.** With 60% failure per attempt and 3 max attempts, probability of all three failing = 0.6³ = **21.6%**. Actual failure rate: **21.8%**. The retry is working exactly as the probability model predicts.

Those **825 requests with latency >500ms** are orders that failed on the first attempt but succeeded on retry. Without retry, they're lost sales. With retry, they're completed transactions — and none of them charged the customer twice.

**Idempotency replay: 100%.** Every duplicate request — simulating the "response lost in transit" scenario — returned the cached result without executing the payment handler. The 100% rate held across both this test and the dedicated idempotency test run independently.

**Lifecycle test: 4/4.** This validates the subtle but critical behavior:
- Handler fails → key **not** cached → retry executes handler again ✓
- Handler succeeds → key cached → duplicate request returns replay ✓

A naive idempotency implementation that caches failures would block legitimate retries. This one doesn't.

---

## Test 4: The idempotency contract

**Script:** `idempotency.k6.js` — four parallel scenarios, 1383 total iterations.

```
  replay success rate:    100%
  missing Idempotency-Key → 422:   30/30
  invalid key format → 422:        30/30
  overall fail rate:               3.3%   (same as baseline)
  p95 latency:                     1322ms
```

The contract is enforced at the boundary. A client that forgets to send an `Idempotency-Key` header gets a 422 — not a silent pass-through that bypasses the protection. Invalid key formats are rejected before touching any business logic.

The `3.3%` overall failure rate is statistically identical to the baseline `3.42%`. The idempotency layer adds zero latency and zero failures to the normal flow.

---

## Test 5: The system that tunes itself

**Script:** `auto-learning.k6.js` — three phases over 160 seconds.

This is the part that has no equivalent in the NestJS ecosystem.

```
Phase 1 — Baseline  (t=0s):    5 VUs, 5% failure, 100ms delay
Phase 2 — Stress    (t=50s):   25 VUs, 85% failure, 1000ms delay
Phase 3 — Recovery  (t=110s):  5 VUs, 2% failure, 80ms delay
```

The auto-learning module observes every request, runs z-score analysis on latency and error distributions, and adjusts configuration on a 30-second feedback cycle.

Here's what the logs showed:

```
t=0s    Initial config:
        timeoutMs=2804ms  maxRetries=2  cbFailureThreshold=10

[t=50s to t=100s — stress is running, system is collecting data]

t=105s  AUTO-LEARNING ADJUSTS:
        timeoutMs:  2804ms → 3916ms  (+40%)
        maxRetries: 2 → 3            (+1)
        cbFailureThreshold: unchanged

t=110s  Recovery phase begins
        Config maintained — insufficient recovery data for next cycle
```

**55 seconds** from stress beginning to autonomous configuration change. Two decisions made without human intervention:

- **timeoutMs +40%** — the gateway was responding in ~1000ms. The system widened its timeout window to avoid prematurely failing requests that would eventually succeed.
- **maxRetries +1** — high failure rate detected. One more retry attempt increases recovery probability from 78.4% to 91.6% under those conditions.

The `cbFailureThreshold` stayed at 10. The system identified that the circuit breaker configuration was already correct for the observed pattern and left it alone.

**The config did not revert during recovery.** This is intentional — the system is conservative. It needs sustained evidence of healthy traffic before relaxing thresholds, to avoid oscillating between states. In production, that's the right behavior.

The health check on the auto-learning endpoint: **100%** throughout all 160 seconds.

---

## What the numbers say together

| Scenario | Failure rate | Success rate | Avg latency | Key result |
|---|---|---|---|---|
| Baseline | 3.4% natural | 96.6% | 1.17s | Reference |
| CB open (80% failure) | 80% | N/A | **5ms** fast-fail | Service stays healthy |
| Retry 60% failure | 60% per attempt | **78.2%** | 1.17s + backoff | Math checks out |
| Idempotency replay | — | **100%** | — | Zero double charges |
| Auto-learning | 85% stress | Adaptive | — | Self-adjusted in 55s |

---

## What this is and what it isn't

This is a reference implementation built on [BackendKit Labs](https://github.com/BackendKit-labs/backendkit-monorepo) — a suite of resilience and observability packages for NestJS we're building and validating publicly. The shopify-backend example exists specifically to test these patterns under realistic conditions and share the results.

The suite is young. These tests are part of the validation process, not proof of production hardening. If you run similar patterns in your own codebase and find edge cases, [open an issue](https://github.com/BackendKit-labs/backendkit-monorepo/issues) — that's exactly the feedback that matters at this stage.

The full example, all k6 scripts, and the source are in the [monorepo](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/shopify-backend).

---

*Written by **[Mairon Cuello](https://www.linkedin.com/in/maironcuellomartinez/)** — Building open source resilience tooling for NestJS backends.*
*GitHub: [BackendKit-labs/backendkit-monorepo](https://github.com/BackendKit-labs/backendkit-monorepo)*

---
---

# Construyendo un Checkout Resiliente en NestJS: Retry, Idempotencia y un Sistema que se Autoregula

> **URL canónica:** https://backendkitlabs.dev/blog/checkout-resiliente-nestjs
> **Estado:** Listo para publicar
> **Orden de publicación:** Blog propio → Dev.to (canonical) → Medium (1 semana después)

---

## El problema que nadie menciona

Tenés un payment gateway. Falla a veces. Entonces agregás un retry.

Ahora tenés un problema peor: el cliente hace clic en "Pagar", el request llega a Stripe, el cobro se procesa, pero la respuesta nunca vuelve. El retry se ejecuta. Stripe cobra dos veces.

Eso no es un escenario hipotético. Es el comportamiento por defecto de cualquier implementación naïve de retry, y ocurre en producción todos los días.

Este post trata sobre cómo construimos un sistema de checkout que maneja esto correctamente — con retry que nunca cobra dos veces, un circuit breaker que protege el servicio cuando el gateway se degrada, y un feedback loop que ajusta su propia configuración bajo carga. Después lo pusimos a prueba con k6 y medimos todo.

El código está en el [ejemplo shopify-backend del monorepo](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/shopify-backend).

---

## La arquitectura

El flujo de una orden es un pipeline tipado de cuatro pasos:

```
POST /orders
  → ValidateInventoryStep     verifica stock, reserva unidades
  → CalculatePricingStep      aplica descuentos, calcula total
  → ChargePaymentStep         llama al gateway con retry + idempotencia
  → CreateOrderStep           persiste la orden, emite eventos
```

Cada paso recibe un `OrderContext` tipado, devuelve `Result<OrderContext, OrderError>`, y el pipeline se detiene ante el primer fallo. Sin excepciones, sin cadenas de try/catch — los errores son valores.

El paso de pago es donde ocurre el trabajo interesante:

```typescript
async handle(ctx: OrderContext): Promise<StepResult<OrderContext, OrderError>> {
  const result = await retry(
    async () => {
      const r = await this.client.post<ChargeResponse>('/charge', {
        orderId: ctx.orderId,
        amount: ctx.totalAmount,
        method: ctx.paymentMethod,
      });
      if (!r.ok) throw Object.assign(new Error(r.error.message), { status: r.error.status });
      return r.value.data;
    },
    {
      maxAttempts: 3,
      backoff: { type: 'exponential', baseDelay: 150, maxDelay: 2_000, jitter: 'full' },
      retryIf: { shouldRetry: (e) => e.type === 'http' && (e.status === 503 || e.status === 500) },
      idempotency: {
        enabled: true,
        key: `charge:${ctx.orderId}`,
        ttlMs: 24 * 60 * 60 * 1000,
      },
      hooks: {
        beforeRetry: ({ attempt, delayMs }) =>
          this.logger.warn(`Payment retry ${attempt} para orden ${ctx.orderId} — esperando ${Math.round(delayMs)}ms`),
      },
    },
  );
  // ...
}
```

Tres cosas a notar:
1. La `idempotency.key` es `charge:${ctx.orderId}` — única por orden, no por request. Si el primer intento cobra exitosamente pero la respuesta se pierde, el retry impacta el cache de idempotencia y devuelve el resultado guardado. Stripe nunca se vuelve a llamar.
2. `retryIf` solo reintenta en 500/503 — no en 400/422/404. Los errores de negocio no se reintentan.
3. `jitter: 'full'` aleatoriza el delay del backoff para evitar thundering herd cuando múltiples órdenes fallan simultáneamente.

---

## Test 1: El baseline — tráfico normal

**Script:** `order-flow.k6.js` — rampa hasta 50 VUs en 2 minutos, pipeline completo por iteración.

```
✓ tasa de éxito:     96.58%
✓ latencia p95:      2.03s
  latencia promedio: 1.17s
  throughput:        13.5 órdenes/segundo
  tasa de fallo:     3.42%  (ruido del simulador)
```

Con 50 usuarios concurrentes, el pipeline completo — verificación de inventario, pricing, pago, creación de orden — termina en 1.17 segundos en promedio. El 3.42% de fallo es el ruido de fondo configurado en el simulador de pagos, no errores de la aplicación.

Este es el baseline. Todos los números que siguen se miden contra este.

---

## Test 2: Qué pasa cuando el gateway se degrada

**Script:** `circuit-breaker.k6.js` — configura `PAYMENT_FAILURE_RATE=0.8`, rampa hasta 30 VUs.

Sin circuit breaker, 80% de tasa de fallo significa que el 80% de los requests esperan el timeout completo del gateway antes de fallar. Con 30 VUs × 1-2 segundos de timeout = los threads se agotan, la cola se llena, el servicio entero se degrada — no solo los pagos.

Con circuit breaker:

```
  health endpoint:       100% disponible durante todo el test
  latencia promedio:     5.05ms
  fast-fail:             ~5ms  (vs 1.17s del baseline)
  http_req_failed:       49.99%
```

El `49.99%` de fallos se divide en exactamente la mitad: requests al health check (todos exitosos) y requests de pago (circuit abierto, fast-fail). Cuando el breaker se abre, los fallos de pago vuelven en **5 milisegundos** en vez de esperar 1-2 segundos por un gateway que se sabe que está caído.

El servicio nunca dejó de responder. Los endpoints de health se mantuvieron al 100% durante todo el test. El circuit breaker aisló el fallo de pagos del resto del sistema.

---

## Test 3: Retry + idempotencia con 60% de tasa de fallo

**Script:** `retry-idempotency.k6.js` — tres escenarios concurrentes, 60% de fallo en gateway.

Este es el escenario que más importa en e-commerce. Un gateway fallando al 60% es una dependencia degradada pero no muerta — exactamente cuando el retry es más valioso y más peligroso.

```
  [retry_resilience]   tasa de éxito:         78.2%
  [retry_resilience]   requests reintentadas:  825  con latencia >500ms
  [idempotency_replay] replay rate:            100.0%
  [lifecycle]          ciclos correctos:       4/4
  p95 latencia (con reintentos):               1345ms
```

**La matemática es exacta.** Con 60% de fallo por intento y 3 intentos máximos, la probabilidad de que fallen los tres es 0.6³ = **21.6%**. Tasa de fallo real: **21.8%**. El retry funciona exactamente como predice el modelo probabilístico.

Esas **825 requests con latencia >500ms** son órdenes que fallaron en el primer intento pero tuvieron éxito en el retry. Sin retry, son ventas perdidas. Con retry, son transacciones completadas — y ninguna cobró dos veces al cliente.

**Idempotency replay: 100%.** Cada request duplicado — simulando el escenario de "respuesta perdida en tránsito" — devolvió el resultado cacheado sin ejecutar el handler de pago. La tasa del 100% se mantuvo tanto en este test como en el test de idempotencia corrido de forma independiente.

**Lifecycle test: 4/4.** Valida el comportamiento sutil pero crítico:
- Handler falla → clave **no** se cachea → retry ejecuta el handler de nuevo ✓
- Handler tiene éxito → clave cacheada → request duplicado devuelve replay ✓

Una implementación naïve de idempotencia que cachea también los fallos bloquearía los reintentos legítimos. Esta no lo hace.

---

## Test 4: El contrato de idempotencia

**Script:** `idempotency.k6.js` — cuatro escenarios paralelos, 1383 iteraciones totales.

```
  replay success rate:              100%
  sin Idempotency-Key → 422:        30/30
  formato de clave inválido → 422:  30/30
  tasa de fallo general:            3.3%   (igual al baseline)
  latencia p95:                     1322ms
```

El contrato se aplica en el borde. Un cliente que olvida enviar el header `Idempotency-Key` recibe un 422 — no un pass-through silencioso que bypasea la protección. Los formatos de clave inválidos se rechazan antes de tocar cualquier lógica de negocio.

La tasa de fallo general del `3.3%` es estadísticamente idéntica al baseline `3.42%`. El layer de idempotencia no agrega latencia ni fallos al flujo normal.

---

## Test 5: El sistema que se regula a sí mismo

**Script:** `auto-learning.k6.js` — tres fases durante 160 segundos.

Esta es la parte que no tiene equivalente en el ecosistema NestJS.

```
Fase 1 — Baseline  (t=0s):    5 VUs, 5% fallo, 100ms delay
Fase 2 — Stress    (t=50s):   25 VUs, 85% fallo, 1000ms delay
Fase 3 — Recovery  (t=110s):  5 VUs, 2% fallo, 80ms delay
```

El módulo de auto-learning observa cada request, corre análisis de z-score sobre las distribuciones de latencia y error, y ajusta la configuración en ciclos de 30 segundos.

Esto es lo que mostraron los logs:

```
t=0s    Config inicial:
        timeoutMs=2804ms  maxRetries=2  cbFailureThreshold=10

[t=50s a t=100s — el stress está corriendo, el sistema recolecta datos]

t=105s  AUTO-LEARNING ACTÚA:
        timeoutMs:  2804ms → 3916ms  (+40%)
        maxRetries: 2 → 3            (+1)
        cbFailureThreshold: sin cambio

t=110s  Fase de recovery comienza
        Config se mantiene — datos de recovery insuficientes para el próximo ciclo
```

**55 segundos** desde que empezó el stress hasta el cambio autónomo de configuración. Dos decisiones tomadas sin intervención humana:

- **timeoutMs +40%** — el gateway respondía en ~1000ms. El sistema amplió su ventana de timeout para no fallar prematuramente requests que eventualmente iban a tener éxito.
- **maxRetries +1** — tasa de error elevada detectada. Un intento más aumenta la probabilidad de recuperación del 78.4% al 91.6% bajo esas condiciones.

El `cbFailureThreshold` se mantuvo en 10. El sistema identificó que la configuración del circuit breaker ya era correcta para el patrón observado y no la tocó.

**La config no revirtió durante el recovery.** Eso es intencional — el sistema es conservador. Necesita evidencia sostenida de tráfico saludable antes de relajar umbrales, para no oscilar entre estados. En producción, ese es el comportamiento correcto.

El health check del endpoint de auto-learning: **100%** durante los 160 segundos completos.

---

## Lo que dicen los números en conjunto

| Escenario | Tasa de fallo | Tasa de éxito | Latencia promedio | Resultado clave |
|---|---|---|---|---|
| Baseline | 3.4% natural | 96.6% | 1.17s | Referencia |
| CB abierto (80% fallo) | 80% | N/A | **5ms** fast-fail | Servicio se mantiene |
| Retry 60% fallo | 60% por intento | **78.2%** | 1.17s + backoff | Matemática exacta |
| Idempotencia replay | — | **100%** | — | Cero cobros dobles |
| Auto-learning | 85% stress | Adaptativo | — | Auto-ajuste en 55s |

---

## Qué es esto y qué no es

Esta es una implementación de referencia construida sobre [BackendKit Labs](https://github.com/BackendKit-labs/backendkit-monorepo) — una suite de resiliencia y observabilidad para NestJS que estamos construyendo y validando públicamente. El ejemplo shopify-backend existe específicamente para testear estos patrones bajo condiciones realistas y compartir los resultados.

La suite es joven. Estos tests son parte del proceso de validación, no evidencia de hardening en producción. Si corrés patrones similares en tu propio código y encontrás edge cases, [abrí un issue](https://github.com/BackendKit-labs/backendkit-monorepo/issues) — ese es exactamente el feedback que importa en esta etapa.

El ejemplo completo, todos los scripts de k6 y el código fuente están en el [monorepo](https://github.com/BackendKit-labs/backendkit-monorepo/tree/master/examples/shopify-backend).

---

*Escrito por **[Mairon Cuello](https://www.linkedin.com/in/maironcuellomartinez/)** — Construyendo herramientas de resiliencia open source para backends NestJS.*
*GitHub: [BackendKit-labs/backendkit-monorepo](https://github.com/BackendKit-labs/backendkit-monorepo)*
