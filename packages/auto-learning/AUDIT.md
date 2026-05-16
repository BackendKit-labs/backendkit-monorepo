# Auto-Learning — Audit & Fix Plan

> Trazabilidad de los hallazgos de auditoría de `@backendkit-labs/auto-learning` y su integración con `circuit-breaker` / `bulkhead`. Fecha de auditoría: **2026-05-16**.

**Estado global:** 4/19 resueltos · 4/7 críticos · 0/9 logica/diseño · 0/3 minores priorizados

Leyenda de status: `🟥 TODO` · `🟧 IN PROGRESS` · `🟩 DONE` · `⬜ WONT-FIX`

---

## 🔴 Bugs Críticos (rompen funcionalidad anunciada)

### #1 — `configChanges` siempre vacío en el cycle event
- **Status:** 🟩 DONE — `feedback-loop.ts` captura `previousConfig` antes de `tune()`
- **Archivo:** `src/core/feedback-loop/feedback-loop.ts:140-149`
- **Problema:** `previousConfig` se captura **después** de que `tune()` mutó `currentConfig`, por lo que se compara el config contra sí mismo. El diff siempre es `{}`.
- **Fix propuesto:**
  - Capturar `const previousConfig = this.configTuner.getCurrentConfig()` **antes** de llamar a `tune()`.
  - Idealmente, separar `tune` en `computeNext()` puro + `apply()` (ver #9).
- **Tests a agregar:**
  - Cycle event reporta `configChanges` no vacío cuando hay cambios.
  - Cycle event reporta `configChanges` vacío cuando no hay cambios.
- **Commit sugerido:** `fix(auto-learning): capture previous config before tuning to detect changes`

---

### #2 — Interceptor NestJS no registra requests fallidos
- **Status:** 🟩 DONE — `tap({next, error})` + extracción de status de la excepción + log de Result descartado + skip non-http
- **Archivo:** `src/nestjs/auto-learning.interceptor.ts:36-49`
- **Problema:** Usa `tap(() => ...)` que sólo dispara en éxito. Excepciones del handler nunca llegan al `recordPattern`, así que la detección de errores nunca ve `statusCode >= 500`.
- **Fix propuesto:**
  ```typescript
  return next.handle().pipe(
    tap({
      next: () => this.record(req, start, res.statusCode, options),
      error: (err) => this.record(req, start, err?.status ?? err?.getStatus?.() ?? 500, options),
    }),
  );
  ```
  Extraer un método `private record(req, start, status, options)` para no duplicar.
- **Tests a agregar:**
  - Handler que lanza `HttpException(500)` registra un pattern con `statusCode = 500`.
  - Handler que lanza `HttpException(404)` registra un pattern con `statusCode = 404`.
  - Handler exitoso sigue registrando con el status code correcto.
- **Commit sugerido:** `fix(auto-learning): record patterns on error path in NestJS interceptor`

---

### #3 — Detección de `error_rate` invertida y rota
- **Status:** 🟩 DONE — alerta cuando `statusCode >= 500 && baseline.errorRate < errorRateThreshold`
- **Archivo:** `src/core/anomaly-detector/anomaly-detector.ts:43-60`
- **Problema:**
  1. Sólo alerta cuando `baseline.errorCount >= 3` (lógica invertida — debería ser lo contrario).
  2. `currentErrorRate = 1.0` hardcodeado no es un rate real.
  3. `1.0 > baseline.errorRate * 2` exige `baseline.errorRate < 0.5`, así que no alerta cuando el sistema está degradado.
  4. `errorRateThreshold` del config nunca aporta valor real.
- **Fix propuesto:**
  - Recibir un agregado del periodo actual (no la call individual) y comparar `currentAggregate.errorRate` contra `baseline.errorRate` usando un delta absoluto o un factor relativo.
  - Alternativa más simple: alertar si `current.statusCode >= 500 && baseline.errorRate < this.config.errorRateThreshold` (señalizar errores en sistemas que normalmente están sanos).
  - Documentar la fórmula elegida en un comment.
- **Tests a agregar:**
  - Endpoint sano (baseline errorRate ~0) + error 500 → alerta high.
  - Endpoint ya degradado (baseline errorRate 0.5) + error 500 → no genera nuevo report (ya está roto, no es noticia).
- **Commit sugerido:** `fix(auto-learning): invert error_rate anomaly logic — alert on errors in healthy endpoints`

---

### #4 — `batchAnalyze` genera N anomalías idénticas para endpoints desconocidos
- **Status:** 🟩 DONE — `seenUnknown: Set<string>` deduplica por `method:path`
- **Archivo:** `src/core/anomaly-detector/anomaly-detector.ts:84-103`
- **Problema:** Itera cada pattern y emite `unknown_endpoint` por cada uno. 1000 hits → 1000 reports idénticos. Inflan `anomalies.length` en `ConfigTuner` y bajan agresivamente `failureThreshold`.
- **Fix propuesto:**
  ```typescript
  const seenUnknown = new Set<string>();
  // dentro del loop:
  if (!baseline) {
    if (this.config.enableUnknownEndpointDetection && !seenUnknown.has(key)) {
      seenUnknown.add(key);
      reports.push({ ... });
    }
    continue;
  }
  ```
- **Tests a agregar:**
  - 100 patterns del mismo endpoint sin baseline → 1 sola anomalía `unknown_endpoint`.
  - 100 patterns de 5 endpoints distintos sin baseline → 5 anomalías.
- **Commit sugerido:** `fix(auto-learning): deduplicate unknown_endpoint anomalies per method:path`

---

### #5 — Memory leak: `InMemoryStorage` crece sin límite
- **Status:** 🟥 TODO
- **Archivo:** `src/core/persistence/in-memory-storage.ts:26-29`
- **Problema:** `patterns`, `anomalies`, `cycles` son arrays push-only. `prune()` existe pero nadie lo llama. En producción el heap crece monotónicamente.
- **Fix propuesto:**
  - Opción A (recomendada): añadir `maxPatterns`, `maxAnomalies`, `maxCycles` al constructor (default sensato, p.ej. `10_000 / 1_000 / 1_000`) y hacer FIFO drop al exceder.
  - Opción B: llamar a `prune(now - 24h)` periódicamente desde `FeedbackLoop` al final de cada ciclo.
  - Recomiendo **ambos**: hard cap por seguridad + prune temporal por intención.
- **Tests a agregar:**
  - Insertar `maxPatterns + 100` patterns → `length === maxPatterns`, los más viejos drop.
  - Prune deja sólo los registros dentro del TTL.
- **Commit sugerido:** `fix(auto-learning): add bounded storage + periodic prune to prevent unbounded memory growth`

---

### #5b — `PatternRegistry.getStats` crashea con muchos patterns
- **Status:** 🟥 TODO
- **Archivo:** `src/core/pattern-registry/pattern-registry.ts:92-93`
- **Problema:** `Math.min(...timestamps)` con arrays grandes lanza `RangeError: Maximum call stack size exceeded`.
- **Fix propuesto:**
  ```typescript
  let oldest = all[0].timestamp.getTime();
  let newest = oldest;
  for (const p of all) {
    const t = p.timestamp.getTime();
    if (t < oldest) oldest = t;
    if (t > newest) newest = t;
  }
  ```
- **Tests a agregar:**
  - `getStats()` con 100k patterns no lanza ni cuelga.
- **Commit sugerido:** `fix(auto-learning): avoid stack overflow in getStats for large pattern arrays`

---

### #6 — `key.split(':')` rompe rutas parametrizadas
- **Status:** 🟥 TODO
- **Archivo:** `src/core/persistence/in-memory-storage.ts:65-66`
- **Problema:** Path `/users/:id` produce key `GET:/users/:id` → `split(':')` devuelve `['GET', '/users/', 'id']` → `path = '/users/'`. Las rutas parametrizadas se reagrupan/pierden.
- **Fix propuesto:** No usar string keys. Cambiar el agrupado a una key estructurada:
  ```typescript
  const groups = new Map<string, { method: string; path: string; items: EndpointPattern[] }>();
  for (const p of recent) {
    const key = `${p.method}\x00${p.path}`; // separador no-imprimible
    let g = groups.get(key);
    if (!g) { g = { method: p.method, path: p.path, items: [] }; groups.set(key, g); }
    g.items.push(p);
  }
  ```
- **Tests a agregar:**
  - Patterns con path `/users/:id` agregan correctamente sin perder el `:id`.
- **Commit sugerido:** `fix(auto-learning): preserve parameterized paths in pattern aggregation`

---

### #7 — `setInterval` permite ciclos solapados
- **Status:** 🟥 TODO
- **Archivo:** `src/core/feedback-loop/feedback-loop.ts:38-46`
- **Problema:** Si un ciclo dura más que el interval, arranca otro encima — sin mutex.
- **Fix propuesto:**
  ```typescript
  private isProcessing = false;
  // en start():
  this.timerId = setInterval(async () => {
    if (this.isProcessing) {
      this.observability.warn('Skipping cycle: previous still running');
      return;
    }
    this.isProcessing = true;
    try {
      const result = await this.runOnce();
      if (!result.ok) this.observability.error('Feedback loop cycle failed', { error: result.error });
    } finally {
      this.isProcessing = false;
    }
  }, interval);
  ```
- **Tests a agregar:**
  - Mock `runOnce` que tarda 200ms, interval 50ms → no se ejecuta más de una vez en paralelo.
- **Commit sugerido:** `fix(auto-learning): prevent overlapping feedback loop cycles`

---

## 🟡 Problemas de Lógica / Diseño

### #8 — Ventana de Step 1 y Step 2 no atómica
- **Status:** 🟥 TODO
- **Archivo:** `src/core/feedback-loop/feedback-loop.ts:71-108`
- **Problema:** `getPatterns(now - 5min, now)` y `getAggregates(5)` recalculan `Date.now()` por separado. Patterns que llegan entre ambas llamadas aparecen en agregados pero no en `patterns.length`.
- **Fix propuesto:** capturar `windowEnd = new Date()` una sola vez y pasarla a ambos.
  - Requiere extender la API de storage: `getAggregates(windowMinutes, windowEnd?: Date)`.
- **Commit sugerido:** `refactor(auto-learning): use a single window end timestamp per cycle`

---

### #9 — `ConfigTuner.tune` mezcla cómputo + aplicación, miente al caller
- **Status:** 🟥 TODO
- **Archivo:** `src/core/config-tuner/config-tuner.ts:101-124`
- **Problema:** Cuando el cooldown está activo, `tune` descarta el `newConfig` y devuelve `getCurrentConfig()` igual que en éxito. El caller no puede distinguir.
- **Fix propuesto:** separar responsabilidades:
  ```typescript
  // puro
  computeNext(aggregates, anomalies): TunableConfig;
  // efectos
  applyConfig(next): Result<{ applied: boolean; prev: TunableConfig; next: TunableConfig }, LearningError>;
  ```
  Mantener `tune()` como wrapper deprecado o hacer breaking change.
- **Nota:** este fix está acoplado con #1.
- **Commit sugerido:** `refactor(auto-learning): split ConfigTuner.tune into compute + apply`

---

### #10 — Cooldown hardcodeado de 60s, ignora `FeedbackLoopConfig.cooldownBetweenChangesMs`
- **Status:** 🟥 TODO
- **Archivo:** `src/core/config-tuner/config-tuner.ts:103`
- **Problema:** El config declara `cooldownBetweenChangesMs: 120_000` pero el tuner usa `60_000` literal.
- **Fix propuesto:** mover el cooldown al `ConfigTunerConfig` y leer desde `this.config.cooldownMs`. Eliminar el campo del `FeedbackLoopConfig` (no era responsabilidad del loop) — o mantenerlo y propagarlo al tuner.
- **Commit sugerido:** `fix(auto-learning): make tuner cooldown configurable instead of hardcoded`

---

### #11 — `errorRateThreshold` nunca aporta efecto real
- **Status:** ⬜ Resuelto implícitamente por #3
- **Nota:** una vez arreglado #3, validar que `errorRateThreshold` se usa de verdad. Si no, eliminarlo.

---

### #12 — `stdDev` mal nombrado — no es desviación estándar
- **Status:** 🟥 TODO
- **Archivo:** `src/core/anomaly-detector/anomaly-detector.ts:128-130`
- **Problema:** `(p95 − p50) / 2` no es σ. Para distribución normal `p95 − p50 ≈ 1.645σ`.
- **Fix propuesto (opción 1):** renombrar a `latencyDispersion()` y actualizar el threshold (`latencyStdDevThreshold` → `latencyDispersionThreshold`).
- **Fix propuesto (opción 2):** calcular σ real recorriendo `items` en `getAggregates` y persistirla en el `AggregatePattern`.
- **Recomendación:** opción 2 — más fiel matemáticamente y abre puerta a z-scores reales.
- **Commit sugerido:** `feat(auto-learning): compute real stddev in aggregates`

---

### #13 — Adapter sólo actualiza CBs/BHs ya existentes
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning-adapters.service.ts:55-82`
- **Problema:** CBs/BHs creados después del cambio usan defaults hasta el próximo ciclo.
- **Fix propuesto:**
  - Añadir API en `CircuitBreakerRegistry`/`BulkheadRegistry`: `setGlobalDefaults(config)` o `applyToAll(updater)`.
  - El adapter llama esa API en vez de iterar `allMetrics`.
  - Cuando se crea un CB/BH nuevo, hereda los defaults globales.
  - Esto cruza paquetes: requiere bump menor en `circuit-breaker` y `bulkhead`.
- **Commit sugerido:** `feat(circuit-breaker,bulkhead,auto-learning): add registry-wide config overrides`

---

### #14 — Results ignorados (errores de storage silenciados)
- **Status:** 🟥 TODO
- **Archivos:**
  - `src/core/feedback-loop/feedback-loop.ts:120-122` — `saveAnomaly`
  - `src/core/persistence/file-storage.ts:33` — `super.saveConfig`
  - `src/nestjs/auto-learning.interceptor.ts:41` — `recordPattern`
- **Fix propuesto:**
  - En el loop, loguear `error` si `saveAnomaly` falla.
  - En `FileStorageAdapter.loadConfig`, propagar el `Result.fail` si super falla.
  - En el interceptor, loguear vía `observability` si `recordPattern` falla.
- **Commit sugerido:** `fix(auto-learning): log discarded Result errors instead of swallowing them`

---

### #15 — `storage: 'redis' | 'sql'` declarado pero no implementado
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning.module.ts:13-15`
- **Fix propuesto:** decidir entre:
  - **A.** Remover los campos del tipo público hasta que se implementen.
  - **B.** Implementar al menos `redis` con `ioredis`.
- **Recomendación:** A por ahora — eliminar `storage`, `redisUrl` de `AutoLearningModuleOptions`. Documentar que la persistencia se configura vía `coreOptions.storage`.
- **Commit sugerido:** `chore(auto-learning): remove unimplemented redis/sql options from NestJS module`

---

### #16 — Feedback loop no arranca automáticamente desde el módulo NestJS
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning.module.ts` (y/o nuevo bootstrap service)
- **Fix propuesto:**
  - En `AutoLearningAdaptersService` (o un nuevo `AutoLearningBootstrapService`):
    ```typescript
    async onApplicationBootstrap() {
      this.core.startFeedbackLoop(this.options.intervalMs);
    }
    onModuleDestroy() {
      this.core.stopFeedbackLoop();
    }
    ```
  - Documentar que si el usuario quiere control manual, puede desactivar con `autoStart: false`.
- **Commit sugerido:** `feat(auto-learning): auto-start feedback loop on bootstrap (with autoStart opt-out)`

---

### #17 — `req.url` mete query string en el path → cardinalidad explota
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning.interceptor.ts:53-57`
- **Fix propuesto:**
  ```typescript
  const rawPath = req.route?.path ?? req.path ?? req.url ?? '/';
  const path = rawPath.split('?')[0];
  ```
- **Tests a agregar:**
  - Request a `/users?id=42` → pattern.path === `/users`.
- **Commit sugerido:** `fix(auto-learning): strip query string from extracted path`

---

### #18 — Listeners sin desuscripción → leak en tests/HMR
- **Status:** 🟥 TODO
- **Archivos:** `ConfigTuner.listeners`, `FeedbackLoop.cycleListeners`
- **Fix propuesto:** que `onConfigChange` / `onCycle` retornen una función de unsubscribe:
  ```typescript
  onConfigChange(callback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
  ```
  Esto es un **breaking change** menor del tipo de retorno (de `void` a `() => void`).
- **Commit sugerido:** `feat(auto-learning): allow unsubscribing from config/cycle listeners`

---

### #19 — Interceptor sólo cubre contexto HTTP
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning.interceptor.ts:33`
- **Fix propuesto:**
  ```typescript
  if (context.getType() !== 'http') return next.handle();
  ```
- **Commit sugerido:** `fix(auto-learning): skip non-http execution contexts in interceptor`

---

## 🟢 Bad Practices / Minores (priorizados)

### #20 — `LearningError` no es un discriminated union real
- **Status:** 🟥 TODO
- **Archivo:** `src/core/errors.ts`
- **Fix:** convertir a union de variantes con campos específicos por tag.

### #24 — `AutoLearn` declara `trackParams`/`trackBody` pero no se usan
- **Status:** 🟥 TODO
- **Archivo:** `src/nestjs/auto-learning.decorator.ts`
- **Fix:** o implementar (capturarlos en `metadata`) o eliminar.

### #27 — `analyze` devuelve sólo `reports[0]`, descartando combinaciones
- **Status:** 🟥 TODO
- **Archivo:** `src/core/anomaly-detector/anomaly-detector.ts:62`
- **Fix:** devolver `AnomalyReport[]` o el report de mayor severidad.

---

## 📋 Orden de Ejecución Recomendado

Sprint 1 — Bugs que invalidan la funcionalidad:
1. **#2** — Interceptor con `tap.error`
2. **#1** — Capturar `previousConfig` antes de `tune`
3. **#3** — Lógica de `error_rate` corregida
4. **#4** — Deduplicar `unknown_endpoint`

Sprint 2 — Tiempo-bomba en producción:
5. **#5 + #5b** — Storage acotado + `getStats` sin spread
6. **#6** — Paths parametrizados preservados
7. **#7** — Mutex en `setInterval`
8. **#17** — Strip query string

Sprint 3 — Higiene y diseño:
9. **#9** — Separar `computeNext` y `applyConfig`
10. **#10** — Cooldown configurable
11. **#14** — Logging de Results descartados
12. **#16** — Bootstrap automático del feedback loop
13. **#18** — Unsubscribe de listeners
14. **#19** — Skip non-http contexts
15. **#15** — Remover opciones no implementadas
16. **#8** — Window atómica
17. **#13** — Defaults globales en registries (cross-package)
18. **#12** — σ real

Sprint 4 — Minores:
19. **#20** — Discriminated union
20. **#24** — Implementar o eliminar `trackParams`/`trackBody`
21. **#27** — `analyze` retorna array

---

## 📝 Convenciones

- Cada fix debe incluir test(s) regresión.
- Bumps de versión:
  - Sólo bugs de comportamiento (#1–#7): `patch` (0.1.4 → 0.1.5, 0.1.6...).
  - Cambios de API (#9, #13, #15, #16, #18): `minor` (0.1.x → 0.2.0) y agrupar en un solo release.
- Marcar cada fix como `🟩 DONE` con commit hash y fecha al completarse.

---

_Última actualización: 2026-05-16 — inicio del audit._
