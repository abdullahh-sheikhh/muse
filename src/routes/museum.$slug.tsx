import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Download, QrCode, BadgeCheck, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/QrScanner";
import { RefMicButton } from "@/components/RefMicButton";
import { fromIso3, nativeName } from "@/lib/guide-languages";
import { LANGUAGES, lang } from "@/lib/languages";
import { museumPhoto } from "@/lib/museum-photos";
import {
  cachePackAudio,
  getDownloadedPack,
  getPreferredLanguage,
  logEvent,
  setPreferredLanguage,
} from "@/lib/visitor";

export const Route = createFileRoute("/museum/$slug")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Museum guide — Muse" },
      { name: "description", content: "Listen to the stories behind every artwork." },
      { property: "og:title", content: "Museum guide — Muse" },
      { property: "og:description", content: "Listen to the stories behind every artwork." },
    ],
  }),
  component: MuseumPage,
});

type Artifact = {
  id: string;
  ref: string;
  title: string;
  artist: string;
  room: string;
  description: string;
  image_url: string | null;
  sort_order: number;
};

function MuseumPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [preferred, setPreferred] = useState("en");
  const [importing, setImporting] = useState(false);

  const { data: museum, isLoading } = useQuery({
    queryKey: ["museum", slug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("museums")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: artifacts } = useQuery({
    queryKey: ["artifacts", museum?.id],
    enabled: !!museum,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artifacts")
        .select("id, ref, title, artist, room, description, image_url, sort_order")
        .eq("museum_id", museum!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Artifact[];
    },
  });

  const artQuery = refInput.trim().toLowerCase();
  const visibleArtifacts = artQuery
    ? (artifacts ?? []).filter((a) =>
        `${a.ref} ${a.title} ${a.artist} ${a.room} ${a.description}`.toLowerCase().includes(artQuery),
      )
    : (artifacts ?? []);

  async function importArtworks() {
    if (!museum || importing) return;
    setImporting(true);
    try {
      const res = await fetch("/api/public/import-artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ museum_id: museum.id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        imported?: number;
      } | null;
      if (json?.ok) {
        await queryClient.invalidateQueries({ queryKey: ["artifacts", museum.id] });
        if (json.imported) toast.success(`${json.imported} artworks loaded.`);
      } else {
        toast.error(json?.error ?? "Couldn't load artworks");
      }
    } catch {
      toast.error("Couldn't load artworks right now — try again in a moment.");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    if (museum) {
      logEvent("open", museum.id);
      setDownloaded(getDownloadedPack(museum.id));
      setPreferred(getPreferredLanguage());
    }
  }, [museum]);

  async function lookup(e?: React.FormEvent, spoken?: string) {
    e?.preventDefault();
    const ref = (spoken ?? refInput).trim();
    if (!ref || !museum) return;
    setRefError(false);
    // Exact catalogue-number match jumps straight to the artwork.
    const { data, error } = await supabase.rpc("lookup_artifact", { _slug: slug, _ref: ref });
    const hit = !error ? data?.[0] : undefined;
    if (hit?.artifact_ref) {
      logEvent("number_entry", museum.id);
      navigate({ to: "/museum/$slug/artifact/$ref", params: { slug, ref: hit.artifact_ref } });
      return;
    }
    // Otherwise the list is already filtered live; a single match opens directly.
    const only = visibleArtifacts.length === 1 ? visibleArtifacts[0] : undefined;
    if (only) {
      navigate({ to: "/museum/$slug/artifact/$ref", params: { slug, ref: only.ref } });
    } else if (visibleArtifacts.length === 0) {
      setRefError(true);
    }
  }

  async function downloadPack(language: string) {
    if (!museum || !artifacts?.length) return;
    setPickerOpen(false);
    setProgress(0);
    try {
      // Prepare every artwork's guide (generated once, then cached server-side), half the bar.
      const files: { ref: string; url: string }[] = [];
      let prepared = 0;
      const queue = [...artifacts];
      const worker = async () => {
        for (let a = queue.shift(); a; a = queue.shift()) {
          const res = await fetch("/api/public/artwork-guide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artwork_id: a.id, language }),
          });
          const json = (await res.json().catch(() => null)) as { ok?: boolean; audio_url?: string | null } | null;
          if (json?.ok && json.audio_url) files.push({ ref: a.ref, url: json.audio_url });
          prepared += 1;
          setProgress((prepared / artifacts.length) * 0.5);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (files.length === 0) throw new Error();
      await cachePackAudio(museum.id, language, files, (f) => setProgress(0.5 + f * 0.5));
      await setPreferredLanguage(language);
      setPreferred(language);
      setDownloaded(language);
      toast.success(`Guide downloaded — it now works offline in ${lang(language).english}.`);
    } catch (err) {
      console.error("[download]", err);
      toast.error("Download failed. Check your connection and try again.");
    } finally {
      setProgress(null);
    }
  }

  function onQr(text: string) {
    setScanning(false);
    try {
      const url = new URL(text, window.location.origin);
      const m = url.pathname.match(/^\/museum\/([^/]+)\/artifact\/([^/]+)$/);
      if (m?.[1] && m[2] && museum) {
        const target = { slug: decodeURIComponent(m[1]), ref: decodeURIComponent(m[2]) };
        if (target.slug !== slug) {
          toast.error("This QR code belongs to another museum", {
            action: {
              label: "Open it",
              onClick: () => navigate({ to: "/museum/$slug/artifact/$ref", params: target, search: { src: "qr" } }),
            },
          });
          return;
        }
        // The artwork page logs the qr_scan event (also covers phone-camera scans).
        navigate({ to: "/museum/$slug/artifact/$ref", params: target, search: { src: "qr" } });
        return;
      }
    } catch {
      // fall through
    }
    toast.error("That QR code doesn't point to an artwork here.");
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-warm"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  }
  if (!museum) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm px-6 text-center">
        <h1 className="text-4xl">Museum not found</h1>
        <Link to="/museums" className="text-primary underline">Back to museums near you</Link>
      </main>
    );
  }

  const photo = museumPhoto(slug, museum.image_url);

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-6 pb-12 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <Link to="/museums" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Museums
        </Link>

        <header className="mt-6">
          {photo.url ? (
            <img src={photo.url} alt={photo.subject || museum.name} className="h-44 w-full rounded-3xl object-cover" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-3xl bg-secondary font-display text-7xl text-primary">
              {museum.name.charAt(0)}
            </div>
          )}
          {photo.source && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Photo: {photo.subject}.{" "}
              <a href={photo.source} target="_blank" rel="noreferrer" className="underline">{photo.credit}</a>
            </p>
          )}
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl leading-tight">{museum.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{museum.city}</p>
            </div>
            {museum.is_partner && (
              <span className="mt-2 flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                <BadgeCheck className="h-3.5 w-3.5" /> Pro guide
              </span>
            )}
          </div>
          {museum.intro && <p className="mt-3 text-muted-foreground">{museum.intro}</p>}
        </header>

        <section className="mt-8 space-y-3">
          <>
              {downloaded ? (
                <div className="rounded-2xl bg-accent px-5 py-4 text-sm text-accent-foreground">
                  Guide downloaded in {lang(downloaded).name} — works offline.
                </div>
              ) : (
                <Button
                  className="h-14 w-full rounded-2xl text-base"
                  onClick={() => setPickerOpen(true)}
                  disabled={progress !== null || !artifacts?.length}
                >
                  <Download /> Download audio guide
                </Button>
              )}
              {progress !== null && (
                <p className="text-center text-sm text-muted-foreground">
                  Preparing your offline guide… {Math.round(progress * 100)}%
                </p>
              )}
              {progress !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
              {museum.is_partner && (
                <Button
                  variant="secondary"
                  className="h-14 w-full rounded-2xl text-base"
                  onClick={() => setScanning(true)}
                >
                  <QrCode /> Scan QR
                </Button>
              )}
            </>
            <label className="block rounded-2xl bg-card p-4 shadow-soft">
              <span className="text-sm text-muted-foreground">Guide language</span>
              <select
                value={preferred}
                onChange={(e) => {
                  setPreferred(e.target.value);
                  void setPreferredLanguage(e.target.value);
                }}
                className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-base"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </label>
        </section>

        <form onSubmit={lookup} className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <label className="text-sm font-medium" htmlFor="ref-input">
            Search artworks
          </label>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ref-input"
                value={refInput}
                onChange={(e) => {
                  setRefInput(e.target.value);
                  setRefError(false);
                }}
                placeholder={`Name, artist, room or ${museum.ref_label.toLowerCase()}`}
                className="h-12 rounded-xl pl-11 pr-12"
              />
              <RefMicButton
                onFail={() => document.getElementById("ref-input")?.focus()}
                onResult={(ref, code) => {
                  setRefInput(ref);
                  void lookup(undefined, ref);
                  const spoken = fromIso3(code);
                  if (spoken && spoken !== getPreferredLanguage()) {
                    toast(`Switch guide to ${nativeName(spoken)}?`, {
                      action: {
                        label: "Switch",
                        onClick: () => {
                          void setPreferredLanguage(spoken);
                          setPreferred(spoken);
                        },
                      },
                    });
                  }
                }}
              />
            </div>
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" aria-label="Open artwork">
              <ArrowRight />
            </Button>
          </div>
          {refError && <p className="mt-2 text-sm text-destructive">Nothing found. Check the label or try another word.</p>}
        </form>

        <section className="mt-10">
          <h2 className="text-2xl">Artworks</h2>
          <div className="mt-4 space-y-3">
            {visibleArtifacts.map((a) => (
              <Link
                key={a.id}
                to="/museum/$slug/artifact/$ref"
                params={{ slug, ref: a.ref }}
                className="flex items-center gap-4 rounded-2xl bg-card p-3 shadow-soft transition-transform active:scale-[0.98]"
              >
                {a.image_url ? (
                  <img src={a.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary font-display text-2xl text-primary">
                    {a.title.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.artist}</p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {a.ref}
                </span>
              </Link>
            ))}
            {artifacts?.length === 0 && (
              <div className="rounded-2xl bg-card p-5 text-center shadow-soft">
                <p className="text-muted-foreground">No artworks listed yet.</p>
                <Button
                  variant="secondary"
                  className="mt-4 h-12 w-full rounded-xl"
                  onClick={importArtworks}
                  disabled={importing}
                >
                  {importing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {importing ? "Finding artworks…" : "Load artworks from the web"}
                </Button>
              </div>
            )}
            {artQuery && visibleArtifacts.length === 0 && (artifacts?.length ?? 0) > 0 && (
              <p className="text-muted-foreground">Nothing matches “{refInput.trim()}”.</p>
            )}
          </div>
        </section>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-background/80" onClick={() => setPickerOpen(false)}>
          <div
            className="w-full rounded-t-3xl bg-card p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl">Choose a language</h2>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {[preferred, ...LANGUAGES.map((l) => l.code).filter((c) => c !== preferred)].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => downloadPack(code)}
                  className="flex h-14 w-full items-center gap-3 rounded-2xl bg-secondary px-5 text-left text-base"
                >
                  <span className="text-xl">{lang(code).flag}</span> {lang(code).name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {scanning && <QrScanner onScan={onQr} onClose={() => setScanning(false)} />}
    </main>
  );
}
