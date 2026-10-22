import saintRoch from "@/assets/galerie-saint-roch-official.jpg.asset.json";
import lumiere from "@/assets/musee-lumiere-lyon.jpg.asset.json";
import beauxArts from "@/assets/musee-beaux-arts-lyon.jpg.asset.json";
import { museumDirectoryCorrections } from "@/lib/museum-directory-corrections";

// These seeded entries have unverified/generated database images. Never show them.
const unverifiedDemoSlugs = new Set(["musee-lumiere", "maison-des-brumes", "galerie-saint-roch"]);

export function museumPhoto(slug: string, imageUrl: string | null) {
  const corrected = museumDirectoryCorrections.find(museum => museum.slug === slug);
  if (corrected?.slug === "musee-lumiere") {
    return { url: lumiere.url, subject: `${corrected.name}, ${corrected.city}`, credit: "Jean-Pierre Dalbéra · CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:La_villa_Lumi%C3%A8re_(Institut_Lumi%C3%A8re,_Lyon)_(38855482774).jpg", illustrative: false };
  }
  if (corrected?.slug === "musee-des-beaux-arts-de-lyon") {
    return { url: beauxArts.url, subject: corrected.name, credit: "Limfjord69 · CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Mus%C3%A9e_des_Beaux-Arts_de_Lyon.jpg", illustrative: false };
  }
  if (slug === "galerie-saint-roch") {
    return { url: saintRoch.url, subject: "Galerie Saint-Roch, Paris", credit: "Galerie Saint-Roch · Official website", source: "https://www.galeriesaint-roch.com/", illustrative: false };
  }
  return { url: unverifiedDemoSlugs.has(slug) ? null : imageUrl, subject: "", credit: "", source: "", illustrative: false };
}