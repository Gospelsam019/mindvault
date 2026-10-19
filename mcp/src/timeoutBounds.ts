/**
 * Timeout bounds — issue #77.
 *
 * A per-tool timeout override that is longer than the deadline the MCP client
 * (transport) gives a request is a trap: the client gives up first, the tool
 * keeps working, and the agent sees a transport error for a call that may still
 * commit. This module validates every configured budget against one effective
 * request deadline so the mismatch fails at startup with a clear message.
 *
 * The deadline is `MINDVAULT_TRANSPORT_DEADLINE_MS` (default 300000). Set it to
 * the request timeout your MCP client enforces. `0` turns the check off.
 */

import type { TimeoutBudgets, TimeoutService } from "./httpTimeout.js";
import { normalizeToolName, type ToolTimeoutOverrides } from "./toolTimeoutOverrides.js";

/** Environment variable carrying the effective transport request deadline. */
export const TRANSPORT_DEADLINE_ENV_VAR = "MINDVAULT_TRANSPORT_DEADLINE_MS";

/** Deadline assumed when the variable is unset (ms). */
export const DEFAULT_TRANSPORT_DEADLINE_MS = 300_000;

/** Raised when a configured budget cannot fit inside the transport deadline. */
export class TimeoutBoundsError extends Error {
  readonly name = "TimeoutBoundsError";
  readonly problems: string[];

  constructor(deadlineMs: number, problems: string[]) {
    super(
      `Invalid timeout configuration (${TRANSPORT_DEADLINE_ENV_VAR}=${deadlineMs}ms): ` +
        `${problems.join("; ")}. Lower the budget, or raise ${TRANSPORT_DEADLINE_ENV_VAR} ` +
        `to match your MCP client's request timeout.`,
    );
    this.problems = problems;
  }
}

/**
 * Resolve the transport deadline. An unset or blank value yields the default;
 * a malformed one throws, because a deadline we cannot read cannot be enforced.
 * `0` disables the check.
 */
export function resolveTransportDeadline(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[TRANSPORT_DEADLINE_ENV_VAR];
  if (raw == null || raw.trim() === "") return DEFAULT_TRANSPORT_DEADLINE_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new TimeoutBoundsError(DEFAULT_TRANSPORT_DEADLINE_MS, [
      `${TRANSPORT_DEADLINE_ENV_VAR} must be a non-negative number of milliseconds, got "${raw}"`,
    ]);
  }
  return Math.floor(parsed);
}

/** Every way the configured budgets exceed the deadline; empty when valid. */
export function findTimeoutBoundsProblems(
  budgets: TimeoutBudgets,
  overrides: ToolTimeoutOverrides,
  deadlineMs: number,
): string[] {
  if (deadlineMs <= 0) return [];
  const problems: string[] = [];

  for (const service of Object.keys(budgets).sort() as TimeoutService[]) {
    // A service budget of 0 is the long-standing "no deadline" setting; leave it be.
    if (budgets[service] > deadlineMs) {
      problems.push(`${service} budget ${budgets[service]}ms exceeds the ${deadlineMs}ms deadline`);
    }
  }

  for (const name of Object.keys(overrides).sort()) {
    const ms = overrides[normalizeToolName(name)];
    if (ms === 0) {
      problems.push(`${name} has no deadline (0) but the transport allows ${deadlineMs}ms`);
    } else if (ms > deadlineMs) {
      problems.push(`${name}=${ms}ms exceeds the ${deadlineMs}ms deadline`);
    }
  }

  return problems;
}

/** Throw a `TimeoutBoundsError` when any budget exceeds the transport deadline. */
export function assertTimeoutsWithinDeadline(
  budgets: TimeoutBudgets,
  overrides: ToolTimeoutOverrides,
  deadlineMs: number,
): void {
  const problems = findTimeoutBoundsProblems(budgets, overrides, deadlineMs);
  if (problems.length > 0) throw new TimeoutBoundsError(deadlineMs, problems);
}
