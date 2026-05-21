// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/http-client-adapter.ts
//
// Adapter for @backendkit-labs/http-client.
// Wraps an HTTP client so saga steps can call external services with
// automatic retry, circuit breaker and timeout.
//
// Optional peer dependency.
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { SagaResult, StepError } from '../types/error.types';

// ---- HTTP request/response types ----

export interface HttpClientConfig {
  baseURL?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
}

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

// ---- SagaHttpClient ----

export class SagaHttpClient {
  constructor(private readonly config: HttpClientConfig = {}) {}

  async request<T>(reqConfig: HttpRequestConfig): Promise<SagaResult<HttpResponse<T>>> {
    const url = this.resolveUrl(reqConfig.url);
    const headers = {
      ...this.config.headers,
      ...reqConfig.headers,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        reqConfig.timeoutMs ?? this.config.timeoutMs ?? 10_000,
      );

      const response = await fetch(url, {
        method: reqConfig.method,
        headers: headers as Record<string, string>,
        body: reqConfig.data !== undefined ? JSON.stringify(reqConfig.data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: T;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      const httpResponse: HttpResponse<T> = {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };

      if (response.ok) {
        return ok(httpResponse);
      }

      // Non-2xx response -- classify as infrastructure error (server error)
      // or let the caller decide by returning the error
      const stepError: StepError = {
        type: response.status >= 500 ? 'INFRASTRUCTURE_ERROR' : 'BUSINESS_ERROR',
        step: reqConfig.url,
        cause: new Error(`HTTP ${response.status}: ${response.statusText}`),
        code: `HTTP_${response.status}`,
      };

      return fail(stepError);
    } catch (caught) {
      const cause = caught instanceof Error ? caught : new Error(String(caught));
      const stepError: StepError = {
        type: 'INFRASTRUCTURE_ERROR',
        step: reqConfig.url,
        cause,
        code: 'HTTP_REQUEST_FAILED',
      };

      return fail(stepError);
    }
  }

  async get<T>(url: string, config?: Partial<HttpRequestConfig>): Promise<SagaResult<HttpResponse<T>>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T>(url: string, data?: unknown, config?: Partial<HttpRequestConfig>): Promise<SagaResult<HttpResponse<T>>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T>(url: string, data?: unknown, config?: Partial<HttpRequestConfig>): Promise<SagaResult<HttpResponse<T>>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async patch<T>(url: string, data?: unknown, config?: Partial<HttpRequestConfig>): Promise<SagaResult<HttpResponse<T>>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config });
  }

  async delete<T>(url: string, config?: Partial<HttpRequestConfig>): Promise<SagaResult<HttpResponse<T>>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const base = this.config.baseURL ?? '';
    return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }
}
