export const LANGUAGES = [
  { code: "fr", name: "Français", english: "French", flag: "🇫🇷" },
  { code: "en", name: "English", english: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", english: "Spanish", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", english: "German", flag: "🇩🇪" },
  { code: "it", name: "Italiano", english: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Português", english: "Portuguese", flag: "🇵🇹" },
  { code: "nl", name: "Nederlands", english: "Dutch", flag: "🇳🇱" },
  { code: "zh", name: "中文", english: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "ja", name: "日本語", english: "Japanese", flag: "🇯🇵" },
  { code: "ar", name: "العربية", english: "Arabic", flag: "🇸🇦" },
] as const;

export function lang(code: string) {
  return LANGUAGES.find((l) => l.code === code) ?? { code, name: code, english: code, flag: "🏳️" };
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
