import axios from 'axios';
import type { CancelTokenSource } from 'axios';

export class CancelManager {
  private readonly tokens = new Map<string, CancelTokenSource>();

  getOrCreate(key: string): CancelTokenSource {
    const existing = this.tokens.get(key);
    if (existing) return existing;
    const source = axios.CancelToken.source();
    this.tokens.set(key, source);
    return source;
  }

  cancel(key: string, reason?: string): void {
    const source = this.tokens.get(key);
    if (source) {
      source.cancel(reason ?? `Request ${key} cancelled`);
      this.tokens.delete(key);
    }
  }

  cancelAll(): void {
    for (const [key, source] of this.tokens) {
      source.cancel(`Request ${key} cancelled`);
    }
    this.tokens.clear();
  }

  delete(key: string): void {
    this.tokens.delete(key);
  }

  has(key: string): boolean {
    return this.tokens.has(key);
  }

  get size(): number {
    return this.tokens.size;
  }
}
