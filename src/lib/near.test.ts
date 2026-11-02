import { describe, expect, it } from "vitest";
import { formatNearError, getExplorerTransactionUrl, nearRuntime, parseNearToYocto } from "./near";

describe("NEAR runtime helpers", () => {
  it("uses the configured network defaults without inventing a contract", () => {
    expect(nearRuntime.network).toBe("testnet");
    expect(nearRuntime.contractId).toBe("");
    expect(nearRuntime.milestoneId).toBe("kanso-001");
  });

  it("builds a network-specific explorer link from an actual transaction hash", () => {
    expect(getExplorerTransactionUrl("abc/123")).toContain("/txns/abc%2F123");
  });

  it("normalizes unknown wallet failures into an actionable message", () => {
    expect(formatNearError(new Error("wallet rejected"))).toBe("wallet rejected");
    expect(formatNearError({ unexpected: true })).toContain("NEAR RPC");
  });

  it("parses human NEAR amounts into exact yoctoNEAR without floating point", () => {
    expect(parseNearToYocto("2.4")).toBe("2400000000000000000000000");
    expect(parseNearToYocto("0.02")).toBe("20000000000000000000000");
    expect(() => parseNearToYocto("2.1234567890123456789012345")).toThrow();
  });
});
