import { describe, expect, it } from "vitest";
import { passwordRuleError } from "@/lib/password";

describe("password rule", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordRuleError("kort")).toBe("Password must be at least 8 characters.");
    expect(passwordRuleError("1234567", "The new password")).toBe(
      "The new password must be at least 8 characters."
    );
  });

  it("accepts a password of 8 characters", () => {
    expect(passwordRuleError("12345678")).toBeNull();
  });
});
