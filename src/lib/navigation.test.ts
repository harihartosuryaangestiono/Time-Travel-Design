import { describe, expect, it } from "vitest";
import { isSidebarItemActive } from "./navigation";

describe("isSidebarItemActive", () => {
  it("only activates the exact Cost Control overview route", () => {
    expect(isSidebarItemActive("/cost-control", "/cost-control")).toBe(true);
    expect(isSidebarItemActive("/cost-control/rap", "/cost-control", true)).toBe(false);
  });

  it("keeps a parent navigation item active on its nested detail route", () => {
    expect(isSidebarItemActive("/cost-control/rap/rap-123", "/cost-control/rap")).toBe(true);
    expect(isSidebarItemActive("/cost-control/rab/rab-123", "/cost-control/rab")).toBe(true);
  });

  it("does not match routes that merely share an href prefix", () => {
    expect(isSidebarItemActive("/projects-archive", "/projects")).toBe(false);
  });
});
