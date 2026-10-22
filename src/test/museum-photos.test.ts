import { describe, expect, it } from "vitest";
import { museumPhoto } from "@/lib/museum-photos";

describe("Museum photo identity", () => {
  it("does not substitute an unrelated photo for an unverified museum", () => {
    expect(museumPhoto("musee-lumiere", "/generated-placeholder.jpg").url).toBeNull();
    expect(museumPhoto("maison-des-brumes", "/generated-placeholder.jpg").url).toBeNull();
  });
  it("uses the verified gallery's official photo, not its generated placeholder", () => {
    const photo = museumPhoto("galerie-saint-roch", "/generated-placeholder.jpg");
    expect(photo.url).toBeTruthy();
    expect(photo.url).not.toBe("/generated-placeholder.jpg");
    expect(photo.subject).toBe("Galerie Saint-Roch, Paris");
    expect(photo.source).toBe("https://www.galeriesaint-roch.com/");
  });
});