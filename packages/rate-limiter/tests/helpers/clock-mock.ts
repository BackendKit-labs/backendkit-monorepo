import { Clock } from '../../src/utils';

export class ClockMock implements Clock {
  private _now: number;

  constructor(initialTime: number = 1_000_000) {
    this._now = initialTime;
  }

  now(): number {
    return this._now;
  }

  advance(ms: number): void {
    this._now += ms;
  }

  setTime(time: number): void {
    this._now = time;
  }
}
