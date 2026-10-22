import louvre from "@/assets/louvre-gallery.jpg.asset.json";
import naturalHistory from "@/assets/natural-history-hall.jpg.asset.json";
import kelvingrove from "@/assets/kelvingrove-interior.jpg.asset.json";

// Seeded museum entries are demos; these are explicitly illustrative real photos.
const demoPhotos: Record<string, { url: string; subject: string; credit: string; source: string }> = {
  "musee-lumiere": {
    url: louvre.url,
    subject: "Galerie Médicis, Louvre, Paris",
    credit: "Matt Biddulph · CC BY-SA 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Richelieu_wing_-_Louvre.jpg",
  },
  "maison-des-brumes": {
    url: naturalHistory.url,
    subject: "Natural History Museum, London",
    credit: "David Iliff · CC BY-SA 3.0",
    source: "https://commons.wikimedia.org/wiki/File:Natural_History_Museum_Main_Hall,_London,_UK_-_Diliff.jpg",
  },
  "galerie-saint-roch": {
    url: kelvingrove.url,
    subject: "Kelvingrove Art Gallery and Museum, Glasgow",
    credit: "Osama Shukir Muhammed Amin · CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:General_internal_view._Kelvingrove_Art_Gallery_and_Museum,_Glasgow,_Scotland..JPG",
  },
};

export function museumPhoto(slug: string, imageUrl: string | null) {
  const demo = demoPhotos[slug];
  return demo ? { ...demo, illustrative: true } : { url: imageUrl, subject: "", credit: "", source: "", illustrative: false };
}