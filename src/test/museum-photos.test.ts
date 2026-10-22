import { describe, expect, it } from "vitest";
import { museumPhoto } from "@/lib/museum-photos";

describe("Museum photo identity", () => {
  it("does not substitute an unrelated photo for an unverified museum", () => {
    expect(museumPhoto("musee-lumiere", "/generated-placeholder.jpg").url).toBeNull();
    expect(museumPhoto("maison-des-brumes", "/generated-placeholder.jpg").url).toBeNull();
  });
});