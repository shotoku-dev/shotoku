import { describe, it, expect } from "vitest";
import { toMicros, fromMicros, MICROS_PER_DOLLAR } from "../money.js";

describe("money", () => {
  it("converts dollars to integer micro-units", () => {
    expect(toMicros(5)).toBe(5_000_000);
    expect(toMicros(0.05)).toBe(50_000);
    expect(toMicros(0.000001)).toBe(1);
  });

  it("sums exactly where floating-point dollars do not", () => {
    // The bug we are avoiding:
    expect(0.1 + 0.2).not.toBe(0.3);
    // In micro-units the same sum is exact:
    expect(toMicros(0.1) + toMicros(0.2)).toBe(toMicros(0.3));
  });

  it("round-trips a dollar amount through micro-units", () => {
    expect(fromMicros(toMicros(0.05))).toBeCloseTo(0.05, 6);
    expect(fromMicros(toMicros(19.99))).toBeCloseTo(19.99, 6);
  });

  it("rounds to the nearest micro-unit", () => {
    expect(toMicros(0.0000004)).toBe(0);
    expect(toMicros(0.0000006)).toBe(1);
  });

  it("uses USDC 6-decimal precision", () => {
    expect(MICROS_PER_DOLLAR).toBe(10 ** 6);
  });
});
