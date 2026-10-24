import { DEMO_MODE, DEMO_NOW_MS } from "./mode";

/**
 * Freezes the JS clock at DEMO_NOW_MS so prayer times, the Hijri date and the Ramadhan day are the same in every screenshot run.
 * Imported first by the root layout; does nothing outside the demo build.
 */
if (DEMO_MODE) {
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      // oxlint-disable-next-line no-explicit-any
      super(...((args.length === 0 ? [DEMO_NOW_MS] : args) as [any]));
    }
    static now(): number {
      return DEMO_NOW_MS;
    }
  }
  globalThis.Date = FrozenDate as unknown as DateConstructor;
}
