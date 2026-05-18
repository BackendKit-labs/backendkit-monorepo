import { Module } from '@nestjs/common';
import { HttpClientModule } from '@backendkit-labs/http-client/nestjs';
import { PAYMENT_CLIENT, SHIPPING_CLIENT } from './tokens';

const port = parseInt(process.env.PORT ?? '3003', 10);
const BASE = `http://localhost:${port}`;

@Module({
  imports: [
    HttpClientModule.forRoot({
      clients: [
        {
          token: PAYMENT_CLIENT,
          config: {
            baseURL: `${BASE}/sim/payment`,
            timeout: 6_000,
            retry: { attempts: 2, delayMs: 100, jitter: true },
            circuitBreaker: {
              name: 'http:payment-gateway',
              failureThreshold: 50,
              openTimeoutMs: 15_000,
              minimumCalls: 10,
              slidingWindowSize: 20,
            },
          },
        },
        {
          token: SHIPPING_CLIENT,
          config: {
            baseURL: `${BASE}/sim/shipping`,
            timeout: 8_000,
            retry: { attempts: 1, delayMs: 200 },
            circuitBreaker: {
              name: 'http:shipping-provider',
              failureThreshold: 40,
              openTimeoutMs: 20_000,
              minimumCalls: 3,
            },
          },
        },
      ],
    }),
  ],
  exports: [HttpClientModule],
})
export class HttpClientsModule { }
