import { describe, expect, it } from "vitest";
import { normalizeSpokenRef } from "@/lib/spoken-ref";

describe("normalizeSpokenRef", () => {
  it("spelled English letters and digits", () => {
    expect(normalizeSpokenRef("I N V four eight eight four")).toBe("INV 4884");
  });
  it("French compound number", () => {
    expect(normalizeSpokenRef("quatre mille huit cent quatre-vingt-quatre")).toBe("4884");
  });
  it("French with letters prefix", () => {
    expect(normalizeSpokenRef("I N V quatre mille huit cent quatre-vingt-quatre")).toBe("INV 4884");
  });
  it("transcribed digits kept", () => {
    expect(normalizeSpokenRef("inv 4884.")).toBe("INV 4884");
  });
  it("English compound number", () => {
    expect(normalizeSpokenRef("four thousand eight hundred eighty four")).toBe("4884");
  });
  it("soixante-dix-sept", () => {
    expect(normalizeSpokenRef("soixante-dix-sept")).toBe("77");
  });
});
