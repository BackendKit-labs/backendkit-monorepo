/**
 * again + idempotency integration stress test
 *
 * Prueba tres comportamientos en conjunto:
 *
 *   retry_resilience — again reintenta el pago hasta 3 veces con backoff exponencial.
 *     Con paymentFailureRate=0.6, P(los 3 fallan) = 0.216, es decir >78% deben completar.
 *
 *   idempotency_replay — misma Idempotency-Key enviada dos veces seguidas.
 *     El segundo request NO ejecuta el handler — devuelve la respuesta cacheada.
 *
 *   lifecycle — demuestra que la clave se BORRA cuando el handler falla:
 *     (1) 100% falla → orden 503 (again agota reintentos)
 *     (2) 0% falla   → misma clave → 201 real (no es replay, el handler corre de nuevo)
 *     (3)             → misma clave → 201 Idempotent-Replayed (ahora sí cacheado)
 */
import http   from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3003';

// ── Métricas ────────────────────────────────────────────────────────────────
const retrySuccessRate  = new Rate('again_retry_success_rate');
const replayRate        = new Rate('again_idempotency_replay_rate');
const lifecycleOk       = new Counter('again_lifecycle_ok');
const paymentRetries    = new Counter('again_payment_retries_triggered');
const orderDuration     = new Trend('again_order_duration_ms');

// ── Opciones ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Escenario 1: reintentos bajo carga con alta tasa de fallo
    retry_resilience: {
      executor:  'ramping-vus',
      startVUs:  0,
      stages: [
        { duration: '15s', target: 20 },
        { duration: '35s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      exec: 'retryResilienceFlow',
    },
    // Escenario 2: replay — misma clave dos veces en cada iteración
    idempotency_replay: {
      executor: 'constant-vus',
      vus:      5,
      duration: '60s',
      exec: 'replayFlow',
    },
    // Escenario 3: ciclo completo — falla → retry con misma clave → replay
    lifecycle: {
      executor:   'per-vu-iterations',
      vus:        1,
      iterations: 4,
      startTime:  '65s',   // empieza después del escenario 1
      exec: 'lifecycleFlow',
    },
  },
  thresholds: {
    // again debe superar la tasa de fallo del gateway (60%) con sus reintentos
    again_retry_success_rate:     ['rate>0.65'],
    // >85% de segundos requests deben ser replays
    again_idempotency_replay_rate: ['rate>0.85'],
    // latencia p95 razonable (includes retries)
    http_req_duration:            ['p(95)<8000'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const ORDER_PAYLOAD = JSON.stringify({
  customerId:    'cust-seed-1',
  items: [{ productId: 'prod-seed-1', variantId: 'var-seed-1', quantity: 1, unitPrice: 2999 }],
  paymentMethod: 'card',
});

function postOrder(idempotencyKey) {
  return http.post(`${BASE}/orders`, ORDER_PAYLOAD, {
    headers: {
      'Content-Type':    'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  });
}

function patchSimConfig(config) {
  return http.patch(`${BASE}/sim/config`, JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────
export function setup() {
  // Alta tasa de fallo para estresar los reintentos de again
  // shippingFailureRate=0 para que el shipping no oscurezca los resultados
  const res = patchSimConfig({ paymentFailureRate: 0.6, shippingFailureRate: 0.0 });
  check(res, { 'setup: sim config aplicado': (r) => r.status === 200 });
  sleep(0.5);
}

export function teardown() {
  patchSimConfig({ paymentFailureRate: 0.2, shippingFailureRate: 0.15 });
}

// ── Escenario 1: Resilencia por reintentos ────────────────────────────────────
// Clave única por VU+iter → handler ejecuta siempre
// Gateway falla 60% → again reintenta → P(fallo total) = 0.6^3 = 21.6%
// Esperamos >65% de éxito (holgura para circuit breaker y otros factores)
export function retryResilienceFlow() {
  const key = `resilience-${__VU}-${__ITER}`;
  const res = postOrder(key);

  const ok = check(res, {
    'retry resilience: 201': (r) => r.status === 201,
    'retry resilience: tiene transactionId': (r) => {
      try { return JSON.parse(r.body).order?.transactionId !== undefined; } catch { return false; }
    },
  });

  retrySuccessRate.add(ok ? 1 : 0);
  orderDuration.add(res.timings.duration);

  // Detectar si hubo reintentos (la latencia es significativamente mayor)
  if (res.timings.duration > 500) {
    paymentRetries.add(1);
  }

  sleep(0.3);
}

// ── Escenario 2: Replay garantizado ──────────────────────────────────────────
// Misma clave por VU (cambia entre iters del mismo VU solo en el primer intento)
// Primera llamada puede ser hit o miss del cache. Segunda siempre debe ser replay.
export function replayFlow() {
  // Usamos VU+iter para que la primera llamada de cada iteración siempre sea nueva
  const key = `replay-${__VU}-${__ITER}`;

  // Primera llamada — gateway puede fallar, again reintenta internamente
  const first = postOrder(key);
  const firstOk = check(first, {
    'replay primera: completó (201 o 503)': (r) => r.status === 201 || r.status === 503,
  });

  if (!firstOk || first.status !== 201) {
    // Si el handler falló, la clave se borró → no hay nada que replay-ear
    sleep(0.5);
    return;
  }

  // Segunda llamada — misma clave, debe ser replay inmediato (no pasa por again)
  const second = postOrder(key);
  const replayed = check(second, {
    'replay segunda: status 201':          (r) => r.status === 201,
    'replay segunda: Idempotent-Replayed': (r) => r.headers['Idempotent-Replayed'] === 'true',
  });
  replayRate.add(replayed ? 1 : 0);

  // Replay debe ser mucho más rápido (no ejecuta el handler)
  check(second, {
    'replay segunda: latencia baja (<300ms)': (r) => r.timings.duration < 300,
  });

  sleep(0.5);
}

// ── Escenario 3: Ciclo de vida completo ──────────────────────────────────────
// Demuestra que la clave se borra cuando el handler falla → cliente puede reintentar con seguridad
export function lifecycleFlow() {
  const key = `lifecycle-${__VU}-${__ITER}`;

  // ── Paso 1: forzar fallo total (again agota todos sus reintentos) ──────────
  patchSimConfig({ paymentFailureRate: 1.0 });
  sleep(0.2);

  const failRes = postOrder(key);
  const handlerFailed = check(failRes, {
    'lifecycle paso1: handler falla (503)': (r) => r.status === 503,
    'lifecycle paso1: NO es replay':        (r) => r.headers['Idempotent-Replayed'] !== 'true',
  });

  if (!handlerFailed) {
    sleep(1);
    return;
  }

  // ── Paso 2: misma clave, ahora el gateway responde bien ──────────────────
  // La clave fue BORRADA cuando el handler falló → debe ejecutar de nuevo (no replay)
  patchSimConfig({ paymentFailureRate: 0.0 });
  sleep(0.3);

  const retryRes = postOrder(key);
  const retryOk = check(retryRes, {
    'lifecycle paso2: 201 (handler corrió de nuevo)': (r) => r.status === 201,
    'lifecycle paso2: NO es replay (clave fue borrada)': (r) => r.headers['Idempotent-Replayed'] !== 'true',
    'lifecycle paso2: tiene transactionId': (r) => {
      try { return JSON.parse(r.body).order?.transactionId !== undefined; } catch { return false; }
    },
  });

  // ── Paso 3: misma clave de nuevo → ahora sí es replay ────────────────────
  const replayRes = postOrder(key);
  const replayOk = check(replayRes, {
    'lifecycle paso3: 201 replay':             (r) => r.status === 201,
    'lifecycle paso3: Idempotent-Replayed':    (r) => r.headers['Idempotent-Replayed'] === 'true',
    'lifecycle paso3: latencia baja (<300ms)': (r) => r.timings.duration < 300,
  });

  if (retryOk && replayOk) lifecycleOk.add(1);

  // Restaurar failure rate moderada para no interferir (aunque startTime ya lo aísla)
  patchSimConfig({ paymentFailureRate: 0.0 });
  sleep(0.5);
}

// ── Resumen ──────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const retrySuccess = (data.metrics.again_retry_success_rate?.values?.rate  ?? 0) * 100;
  const replaySucc   = (data.metrics.again_idempotency_replay_rate?.values?.rate ?? 0) * 100;
  const lifecycle    = data.metrics.again_lifecycle_ok?.values?.count ?? 0;
  const retriesSeen  = data.metrics.again_payment_retries_triggered?.values?.count ?? 0;
  const p95          = data.metrics.again_order_duration_ms?.values?.['p(95)'] ?? 0;

  console.log('\n══════════════════════════════════════════════════════');
  console.log('      again + idempotency — RESULTADOS');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  [retry_resilience]  Órdenes exitosas:  ${retrySuccess.toFixed(1)}%  (gateway falla 60%)`);
  console.log(`  [retry_resilience]  Reintentos vistos: ${retriesSeen} requests con latencia >500ms`);
  console.log(`  [idempotency_replay] Replay rate:      ${replaySucc.toFixed(1)}%`);
  console.log(`  [lifecycle]          Ciclos OK:         ${lifecycle}/4`);
  console.log(`  Latencia p95 (con reintentos):         ${p95.toFixed(0)} ms`);
  console.log('══════════════════════════════════════════════════════\n');
  return {};
}
