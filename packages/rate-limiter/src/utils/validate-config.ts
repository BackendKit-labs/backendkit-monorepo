import { ConfigError } from '../errors';

export function validatePositiveNumber(
  value: unknown,
  name: string,
  allowZero?: boolean,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConfigError(`"${name}" must be a finite number, got ${String(value)}`);
  }
  if (allowZero ? value < 0 : value <= 0) {
    throw new ConfigError(`"${name}" must be a positive${allowZero ? '' : ' finite'} number, got ${value}`);
  }
  return value;
}

export function validatePositiveInt(
  value: unknown,
  name: string,
  allowZero?: boolean,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new ConfigError(`"${name}" must be a finite integer, got ${String(value)}`);
  }
  if (allowZero ? value < 0 : value <= 0) {
    throw new ConfigError(`"${name}" must be a positive${allowZero ? '' : ' finite'} integer, got ${value}`);
  }
  return value;
}
