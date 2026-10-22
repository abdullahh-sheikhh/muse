import { supabase } from "@/integrations/supabase/client";

/** Sign the visitor in anonymously on first launch and make sure they have a profile row. */
export async function ensureVisitor() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) return null;
  await supabase.from("profiles").upsert({ id: anon.user.id }, { onConflict: "id" });
  return anon.user;
}

export type VisitEventType = "number_entry" | "qr_scan" | "open" | "play";

export async function logEvent(eventType: VisitEventType, museumId?: string, artworkId?: string) {
  try {
    const user = await ensureVisitor();
    await supabase.from("visit_events").insert({
      event_type: eventType,
      museum_id: museumId ?? null,
      artwork_id: artworkId ?? null,
      visitor_id: user?.id ?? null,
    });
  } catch {
    // Analytics must never break the visit.
  }
}

// ---- Visitor location ----

export type VisitorLocation = { lat: number; lng: number; label: string };
const LOC_KEY = "muse-location";

export function saveLocation(loc: VisitorLocation) {
  localStorage.setItem(LOC_KEY, JSON.stringify(loc));
}

export function loadLocation(): VisitorLocation | null {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    return raw ? (JSON.parse(raw) as VisitorLocation) : null;
  } catch {
    return null;
  }
}

// ---- Preferred language (mirrored to profiles.preferred_language) ----

const LANG_KEY = "muse-language";

export function getPreferredLanguage(): string {
  return localStorage.getItem(LANG_KEY) ?? "en";
}

export async function setPreferredLanguage(code: string) {
  localStorage.setItem(LANG_KEY, code);
  const user = await ensureVisitor();
  if (user) {
    await supabase
      .from("profiles")
      .upsert({ id: user.id, preferred_language: code }, { onConflict: "id" });
  }
}

// ---- Downloaded audio packs (Cache API) ----

const PACK_CACHE = "muse-packs";
const packKey = (museumId: string, language: string, ref: string) =>
  `/pack/${museumId}/${language}/${encodeURIComponent(ref)}`;

export function getDownloadedPack(museumId: string): string | null {
  return localStorage.getItem(`muse-pack-${museumId}`);
}

export async function cachePackAudio(
  museumId: string,
  language: string,
  files: { ref: string; url: string }[],
  onProgress: (fraction: number) => void,
) {
  if (!("caches" in window)) throw new Error("Offline storage is not available on this device");
  const cache = await caches.open(PACK_CACHE);
  if (files.length === 0) {
    onProgress(1);
  }
  let done = 0;
  for (const file of files) {
    const res = await fetch(file.url);
    if (res.ok) await cache.put(packKey(museumId, language, file.ref), res);
    done += 1;
    onProgress(done / files.length);
  }
  localStorage.setItem(`muse-pack-${museumId}`, language);
}

/** Returns a playable object URL for a cached pack file, or null when not downloaded. */
export async function getCachedAudio(
  museumId: string,
  language: string,
  ref: string,
): Promise<string | null> {
  if (!("caches" in window)) return null;
  const res = await caches.match(packKey(museumId, language, ref));
  if (!res) return null;
  return URL.createObjectURL(await res.blob());
}
