export const GUIDE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "ur", name: "اردو" },
  { code: "hi", name: "हिन्दी" },
  { code: "pt", name: "Português" },
] as const;

const RTL = ["ar", "ur", "he", "fa"];

export function isLanguageTag(s: string) {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(s);
}

export function isRtl(code: string) {
  return RTL.includes((code.split("-")[0] ?? "").toLowerCase());
}

/** Display name of a language in its own language, e.g. "fr" → "français". */
export function nativeName(code: string) {
  const known = GUIDE_LANGUAGES.find((l) => l.code === code);
  if (known) return known.name;
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Turn free text ("Polish", "pl", "pt-BR") into a BCP-47 tag, or null. */
export function toLanguageTag(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const lowered = s.length <= 3 ? s.toLowerCase() : s;
  if (isLanguageTag(lowered)) return lowered;
  try {
    const names = new Intl.DisplayNames(["en"], { type: "language" });
    // Scan common ISO 639-1 codes for an English-name match.
    const letters = "abcdefghijklmnopqrstuvwxyz";
    for (const a of letters)
      for (const b of letters) {
        const code = a + b;
        const name = names.of(code);
        if (name && name !== code && name.toLowerCase() === s.toLowerCase()) return code;
      }
  } catch {
    /* ignore */
  }
  return null;
}

// ElevenLabs returns ISO 639-3 codes.
const ISO3: Record<string, string> = {
  eng: "en", fra: "fr", spa: "es", deu: "de", ita: "it", zho: "zh", cmn: "zh", jpn: "ja",
  kor: "ko", ara: "ar", urd: "ur", hin: "hi", por: "pt", nld: "nl", rus: "ru", pol: "pl",
};
export function fromIso3(code: string) {
  return ISO3[code] ?? (code.length === 2 ? code : null);
}
