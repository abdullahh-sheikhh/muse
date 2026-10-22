// These seeded entries have unverified/generated database images. Never show them.
const unverifiedDemoSlugs = new Set(["musee-lumiere", "maison-des-brumes", "galerie-saint-roch"]);

export function museumPhoto(slug: string, imageUrl: string | null) {
  return { url: unverifiedDemoSlugs.has(slug) ? null : imageUrl, subject: "", credit: "", source: "", illustrative: false };
}