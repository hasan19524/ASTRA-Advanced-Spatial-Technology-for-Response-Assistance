import { describe, it, expect } from "vitest";
import { hasPermission } from "../src/lib/permissions";

describe("hasPermission (permission gating)", () => {
  it("returns true when the user holds the permission", () => {
    expect(hasPermission(["incident.verify", "map.view_public"], "incident.verify")).toBe(true);
    expect(hasPermission(["task.assign"], "task.assign")).toBe(true);
  });

  it("returns false when the user lacks the permission", () => {
    expect(hasPermission(["map.view_public"], "incident.verify")).toBe(false);
    expect(hasPermission(["incident.verify"], "task.assign")).toBe(false);
  });

  it("returns false for undefined / empty permissions", () => {
    expect(hasPermission(undefined, "incident.verify")).toBe(false);
    expect(hasPermission([], "incident.verify")).toBe(false);
  });
});
