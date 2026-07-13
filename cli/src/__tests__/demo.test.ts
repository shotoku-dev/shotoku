import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { DEMO_SCENARIO_NAMES, isDemoScenario, runDemo } from "../demo.js";

async function capture(scenario?: (typeof DEMO_SCENARIO_NAMES)[number]) {
  const lines: string[] = [];
  const result = await runDemo({
    ...(scenario !== undefined ? { scenario } : {}),
    delayMs: 0,
    log: (line) => lines.push(line),
  });
  return { lines, output: lines.join("\n"), result };
}

describe("isDemoScenario", () => {
  it("accepts every declared scenario and rejects unknown names", () => {
    for (const name of DEMO_SCENARIO_NAMES) {
      expect(isDemoScenario(name)).toBe(true);
    }
    expect(isDemoScenario("crypto")).toBe(false);
    expect(isDemoScenario("")).toBe(false);
  });
});

describe("runDemo", () => {
  it("defaults to the payments scenario", async () => {
    const { result } = await capture();
    expect(result.scenario).toBe("payments");
  });

  it("payments scenario shows the over-budget denial money shot", async () => {
    const { output } = await capture("payments");

    expect(output).toContain("✓ APPROVED");
    expect(output).toContain("✗ DENIED");
    expect(output).toContain("◷ PENDING APPROVAL");
    expect(output).toContain("would exceed daily limit of $50");
  });

  it("payments scenario runs four paced steps", async () => {
    const { output, result } = await capture("payments");

    expect(result.statuses).toHaveLength(4);
    for (let step = 1; step <= 4; step += 1) {
      expect(output).toContain(`${step}/4`);
    }
  });

  it("approved steps carry a signed receipt", async () => {
    const { output } = await capture("payments");
    expect(output).toContain("Receipt: rcpt.");
  });

  it("every scenario demonstrates all three outcomes", async () => {
    for (const name of DEMO_SCENARIO_NAMES) {
      const { result } = await capture(name);
      expect(result.scenario).toBe(name);
      expect(new Set(result.statuses)).toEqual(
        new Set(["approved", "denied", "pending_approval"]),
      );
    }
  });

  it("announces the simulation and never touches the working-directory ledger", async () => {
    const ledgerSize = (): number | undefined => {
      try {
        return statSync(resolve(process.cwd(), "data/decisions.jsonl")).size;
      } catch {
        return undefined;
      }
    };

    const before = ledgerSize();
    const { output } = await capture("payments");

    expect(output.toLowerCase()).toContain("simulated");
    expect(ledgerSize()).toBe(before);
  });
});
