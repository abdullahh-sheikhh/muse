import saintRoch from "@/assets/galerie-saint-roch-official.jpg.asset.json";

// These seeded entries have unverified/generated database images. Never show them.
const unverifiedDemoSlugs = new Set(["musee-lumiere", "maison-des-brumes", "galerie-saint-roch"]);

export function museumPhoto(slug: string, imageUrl: string | null) {
  if (slug === "galerie-saint-roch") {
    return { url: saintRoch.url, subject: "Galerie Saint-Roch, Paris", credit: "Galerie Saint-Roch · Official website", source: "https://www.galeriesaint-roch.com/", illustrative: false };
  }
  return { url: unverifiedDemoSlugs.has(slug) ? null : imageUrl, subject: "", credit: "", source: "", illustrative: false };
}