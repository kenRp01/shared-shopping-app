import { describe, expect, it } from "vitest";
import { maskEmailAddress, privateMemberLabel } from "@/lib/privacy";

describe("privacy helpers", () => {
  it("masks email addresses before displaying them in shared settings", () => {
    expect(maskEmailAddress("kensuke@example.com")).toBe("ke***e@e***.com");
    expect(maskEmailAddress("a@b.co")).toBe("a***@b***.co");
    expect(maskEmailAddress("")).toBe("非公開");
    expect(maskEmailAddress("not-an-email")).toBe("非公開");
  });

  it("uses non-personal member labels", () => {
    expect(privateMemberLabel(0, true)).toBe("あなた");
    expect(privateMemberLabel(1, false)).toBe("メンバー2");
  });
});
