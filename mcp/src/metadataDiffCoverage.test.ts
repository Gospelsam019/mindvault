import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS } from "./tools.js";
import { TOOL_ARGUMENT_SPECS } from "./validation.js";

describe("API vs registry metadata diff (mindvault_check_consistency)", () => {
  const tool = TOOL_DEFINITIONS.find((t) => t.name === "mindvault_check_consistency");

  it("is advertised and read-only", () => {
    expect(tool).toBeDefined();
    expect(tool!.annotations.readOnlyHint).toBe(true);
    expect(tool!.annotations.destructiveHint).toBe(false);
  });

  it("documents API, on-chain, mismatches and missing records", () => {
    const description = tool!.description;
    expect(description).toMatch(/API catalog/);
    expect(description).toMatch(/vault-registry contract/);
    expect(description).toMatch(/mismatches/);
    expect(description).toMatch(/missing API records/);
    expect(description).toMatch(/missing on-chain records/);
  });

  it("takes a resource id, not protected content", () => {
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual([
      "expectedMetadataHash",
      "resourceId",
    ]);
    expect(Object.keys(TOOL_ARGUMENT_SPECS.mindvault_check_consistency).sort()).toEqual([
      "expectedMetadataHash",
      "resourceId",
    ]);
  });
});
