/**
 * Rate Limiter example — HTTP server with k6 load tests
 *
 * Run server:  npm install && npm start
 * Run k6:      npm run k6:smoke | k6:load | k6:burst
 *
 * Endpoints
 * ---------
 *  GET /api/token-bucket        — 10 tokens, refill 2/s  → burst-friendly
 *  GET /api/fixed-window        — 20 req / 10 s          → hard window reset
 *  GET /api/sliding-window      — 15 req / 10 s          → smooth approximation
 *  GET /api/multi-weight        — consumes 3 tokens each → shows weighted consume
 *  GET /health                  — no rate limit
 *  GET /stats                   — current limiter state
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  RateLimiterFactory,
} from '@backendkit-labs/rate-limiter';
import type {
  IRateLimiter,
  TokenBucketConfig,
  FixedWindowConfig,
  SlidingWindowCounterConfig,
} from '@backendkit-labs/rate-limiter';

const PORT = parseInt(process.env['PORT'] ?? '4999', 10);
const HOST = process.env['HOST'] ?? '127.0.0.1';

// ── Limiters ──────────────────────────────────────────────────────────────────

const tbConfig: TokenBucketConfig = {
  algorithm: 'token-bucket',
  store: 'memory',
  bucketSize: 10,
  tokensPerSecond: 2,
  keyPrefix: 'tb:',
};

const fwConfig: FixedWindowConfig = {
  algorithm: 'fixed-window',
  store: 'memory',
  windowMs: 10_000,
  maxRequests: 20,
  keyPrefix: 'fw:',
};

const swConfig: SlidingWindowCounterConfig = {
  algorithm: 'sliding-window-counter',
  store: 'memory',
  windowMs: 10_000,
  maxRequests: 15,
  keyPrefix: 'sw:',
};

const tokenBucket = RateLimiterFactory.create(tbConfig);
const fixedWindow  = RateLimiterFactory.create(fwConfig);
const slidingWindow = RateLimiterFactory.create(swConfig);

// ── Stats tracker ─────────────────────────────────────────────────────────────

const stats = {
  'token-bucket':   { allowed: 0, blocked: 0 },
  'fixed-window':   { allowed: 0, blocked: 0 },
  'sliding-window': { allowed: 0, blocked: 0 },
  'multi-weight':   { allowed: 0, blocked: 0 },
};

// ── Rate limit middleware factory ─────────────────────────────────────────────

function rateLimitMiddleware(limiter: IRateLimiter, label: keyof typeof stats, weight = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Use X-User-Id header when present (k6 VU simulation), fall back to IP
    const key = (req.headers['x-user-id'] as string | undefined) ?? req.ip ?? 'unknown';
    const result = await limiter.consume(key, weight);

    if (!result.ok) {
      res.status(500).json({
        error: 'rate_limiter_unavailable',
        message: result.error.message,
      });
      return;
    }

    const { allowed, remaining, resetAt, totalLimit } = result.value;

    // Standard rate-limit headers
    res.set('X-RateLimit-Limit', String(totalLimit));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    res.set('X-RateLimit-Key', key);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      stats[label].blocked++;
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'too_many_requests',
        retryAfter,
        remaining: 0,
        resetAt,
      });
      return;
    }

    stats[label].allowed++;
    next();
  };
}

// ── Simulated work ────────────────────────────────────────────────────────────

function simulateWork(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/stats', (_req, res) => {
  res.json({
    stats,
    timestamp: Date.now(),
    description: {
      'token-bucket':   '10 tokens, refill 2/s',
      'fixed-window':   '20 req / 10 s',
      'sliding-window': '15 req / 10 s',
      'multi-weight':   '10 tokens bucket, weight=3 per call',
    },
  });
});

// Token Bucket — 10 tokens, refills at 2 tokens/s
// Great for API endpoints that should allow short bursts but throttle sustained load
app.get(
  '/api/token-bucket',
  rateLimitMiddleware(tokenBucket, 'token-bucket'),
  async (_req, res) => {
    await simulateWork(5, 15);
    res.json({ ok: true, algorithm: 'token-bucket', ts: Date.now() });
  },
);

// Fixed Window — 20 req per 10s hard window
// Simple and predictable — resets sharply at the window boundary
app.get(
  '/api/fixed-window',
  rateLimitMiddleware(fixedWindow, 'fixed-window'),
  async (_req, res) => {
    await simulateWork(5, 15);
    res.json({ ok: true, algorithm: 'fixed-window', ts: Date.now() });
  },
);

// Sliding Window Counter — 15 req per 10s rolling window
// Smooths out spikes at window boundaries vs fixed window
app.get(
  '/api/sliding-window',
  rateLimitMiddleware(slidingWindow, 'sliding-window'),
  async (_req, res) => {
    await simulateWork(5, 15);
    res.json({ ok: true, algorithm: 'sliding-window-counter', ts: Date.now() });
  },
);

// Weighted consume — each call costs 3 tokens from the token bucket
// Useful for expensive operations (file processing, AI calls, etc.)
app.get(
  '/api/multi-weight',
  rateLimitMiddleware(tokenBucket, 'multi-weight', 3),
  async (_req, res) => {
    await simulateWork(20, 50);
    res.json({ ok: true, algorithm: 'token-bucket', weight: 3, ts: Date.now() });
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│             @backendkit-labs/rate-limiter — example             │
├─────────────────────────────────────────────────────────────────┤
│  http://${HOST}:${PORT}/api/token-bucket       (10 tok, 2/s)      │
│  http://${HOST}:${PORT}/api/fixed-window       (20 req/10s)       │
│  http://${HOST}:${PORT}/api/sliding-window     (15 req/10s)       │
│  http://${HOST}:${PORT}/api/multi-weight       (weight=3)         │
│  http://${HOST}:${PORT}/health                                    │
│  http://${HOST}:${PORT}/stats                                     │
├─────────────────────────────────────────────────────────────────┤
│  k6 tests:                                                      │
│    npm run k6:smoke   — baseline correctness                    │
│    npm run k6:load    — steady 5 VU load over 30s               │
│    npm run k6:burst   — spike to 50 VU to trigger 429s          │
└─────────────────────────────────────────────────────────────────┘
`);
});
