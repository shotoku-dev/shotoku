/**
 * Money is compared and summed in integer micro-units, never in floating-point
 * dollars — because `0.1 + 0.2 !== 0.3` in floating point, and an authorization
 * layer must never be wrong about money by a rounding error.
 *
 * One US dollar is 1,000,000 micro-units, matching the 6-decimal precision of
 * stablecoins like USDC. Dollars appear only at the edges — user input and
 * display; every amount comparison in the engine happens in micro-units.
 */
export const MICROS_PER_DOLLAR = 1_000_000;

/** Convert a dollar amount to integer micro-units, rounded to the nearest micro. */
export function toMicros(dollars: number): number {
  return Math.round(dollars * MICROS_PER_DOLLAR);
}

/** Convert integer micro-units back to a dollar amount, for display. */
export function fromMicros(micros: number): number {
  return micros / MICROS_PER_DOLLAR;
}
