import { describe, expect, it } from "vitest";
import { parseAmountInput } from "./parseAmount";

describe("parseAmountInput", () => {
  it.each([
    ["107610,75", 107610.75],
    ["107610.75", 107610.75],
    ["107.610,75", 107610.75],
    ["107,610.75", 107610.75],
    ["1.234.567", 1234567],
    ["1234", 1234],
  ])("parses %s as %s", (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(["", "1,2345", "1.2345", "1,23,45", "abc"])(
    "rejects invalid amount %s",
    (input) => {
      expect(parseAmountInput(input)).toBeNull();
    }
  );
});
