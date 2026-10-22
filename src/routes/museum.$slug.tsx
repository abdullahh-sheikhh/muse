import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Download, QrCode, BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/QrScanner";
import { LANGUAGES, lang } from "@/lib/languages";
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
  image_url: string | null;
  sort_order: number;
};

function MuseumPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [preferred, setPreferred] = useState("en");

  const { data: museum, isLoading } = useQuery({
    queryKey: ["museum", slug],
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artifacts")
        .select("id, ref, title, artist, image_url, sort_order")
        .eq("museum_id", museum!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Artifact[];
    },
  });

  const { data: packs } = useQuery({
    queryKey: ["audio-packs", museum?.id],
    enabled: !!museum?.is_partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_packs")
        .select("id, language, status")
        .eq("museum_id", museum!.id)
        .eq("status", "ready");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (museum) {
      logEvent("open", museum.id);
      setDownloaded(getDownloadedPack(museum.id));
      setPreferred(getPreferredLanguage());
    }
  }, [museum]);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    const ref = refInput.trim();
    if (!ref || !museum) return;
    setRefError(false);
    const { data, error } = await supabase.rpc("lookup_artifact", { _slug: slug, _ref: ref });
    const hit = !error ? data?.[0] : undefined;
    if (hit?.artifact_ref) {
      logEvent("number_entry", museum.id);
      navigate({ to: "/museum/$slug/artifact/$ref", params: { slug, ref: hit.artifact_ref } });
    } else {
      setRefError(true);
    }
  }

  async function downloadPack(packId: string, language: string) {
    if (!museum) return;
    setPickerOpen(false);
    setProgress(0);
    try {
      const res = await fetch(`/api/public/pack-urls/${packId}`);
      if (!res.ok) throw new Error();
      const { files } = (await res.json()) as { files: { ref: string; url: string }[] };
      await cachePackAudio(museum.id, language, files, setProgress);
      await setPreferredLanguage(language);
      setPreferred(language);
      setDownloaded(language);
      toast.success(`Guide downloaded — it now works offline in ${lang(language).english}.`);
    } catch {
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
        logEvent("qr_scan", museum.id);
        navigate({
          to: "/museum/$slug/artifact/$ref",
          params: { slug: m[1], ref: decodeURIComponent(m[2]) },
        });
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

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-6 pb-12 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <Link to="/museums" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Museums
        </Link>

        <header className="mt-6">
          {museum.image_url ? (
            <img src={museum.image_url} alt="" className="h-44 w-full rounded-3xl object-cover" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-3xl bg-secondary font-display text-7xl text-primary">
              {museum.name.charAt(0)}
            </div>
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
          {museum.is_partner ? (
            <>
              {downloaded ? (
                <div className="rounded-2xl bg-accent px-5 py-4 text-sm text-accent-foreground">
                  Guide downloaded in {lang(downloaded).name} — works offline.
                </div>
              ) : (
                <Button
                  className="h-14 w-full rounded-2xl text-base"
                  onClick={() => setPickerOpen(true)}
                  disabled={progress !== null}
                >
                  <Download /> Download audio guide
                </Button>
              )}
              {progress !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
              <Button
                variant="secondary"
                className="h-14 w-full rounded-2xl text-base"
                onClick={() => setScanning(true)}
              >
                <QrCode /> Scan QR
              </Button>
            </>
          ) : (
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
          )}
        </section>

        <form onSubmit={lookup} className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
          <label className="text-sm font-medium" htmlFor="ref-input">
            {museum.ref_label}
          </label>
          <div className="mt-3 flex gap-2">
            <Input
              id="ref-input"
              value={refInput}
              onChange={(e) => {
                setRefInput(e.target.value);
                setRefError(false);
              }}
              placeholder="As printed on the label"
              className="h-12 rounded-xl"
              autoCapitalize="characters"
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" aria-label="Open artwork">
              <ArrowRight />
            </Button>
          </div>
          {refError && <p className="mt-2 text-sm text-destructive">Number not found. Check the label.</p>}
        </form>

        <section className="mt-10">
          <h2 className="text-2xl">Artworks</h2>
          <div className="mt-4 space-y-3">
            {artifacts?.map((a) => (
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
              <p className="text-muted-foreground">No artworks listed yet.</p>
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
            <div className="mt-4 space-y-2">
              {packs?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => downloadPack(p.id, p.language)}
                  className="flex h-14 w-full items-center gap-3 rounded-2xl bg-secondary px-5 text-left text-base"
                >
                  <span className="text-xl">{lang(p.language).flag}</span> {lang(p.language).name}
                </button>
              ))}
              {packs?.length === 0 && (
                <p className="text-muted-foreground">No downloadable packs yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {scanning && <QrScanner onScan={onQr} onClose={() => setScanning(false)} />}
    </main>
  );
}
