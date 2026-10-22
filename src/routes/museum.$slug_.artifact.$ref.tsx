import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, QrCode, Mic, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AskGuide } from "@/components/AskGuide";
import { GuidePlayer } from "@/components/GuidePlayer";
import { getCachedAudio, getDownloadedPack, logEvent } from "@/lib/visitor";

export const Route = createFileRoute("/museum/$slug_/artifact/$ref")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Artwork — Muse" },
      { name: "description", content: "Listen to the story of this artwork." },
      { property: "og:title", content: "Artwork — Muse" },
      { property: "og:description", content: "Listen to the story of this artwork." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { src?: "qr" } =>
    search["src"] === "qr" ? { src: "qr" } : {},
  component: ArtifactPage,
});

function ArtifactPage() {
  const { slug, ref } = Route.useParams();
  const { src } = Route.useSearch();
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const qrLogged = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["artifact", slug, ref],
    queryFn: async () => {
      const { data: museum, error: mErr } = await supabase
        .from("museums")
        .select("id, name, slug, is_partner")
        .eq("slug", slug)
        .maybeSingle();
      if (mErr || !museum) return null;
      const { data: artifact, error: aErr } = await supabase
        .from("artifacts")
        .select("*")
        .eq("museum_id", museum.id)
        .ilike("ref", ref)
        .maybeSingle();
      if (aErr || !artifact) return null;
      return { museum, artifact };
    },
  });

  useEffect(() => {
    if (!data) return;
    logEvent("open", data.museum.id, data.artifact.id);
    // QR scans: in-app scanner and phone camera both land here with ?src=qr.
    if (src === "qr" && data.museum.is_partner && !qrLogged.current) {
      qrLogged.current = true;
      logEvent("qr_scan", data.museum.id, data.artifact.id);
    }
  }, [data, src]);

  // If a pack was downloaded for this museum, offer the cached file first.
  useEffect(() => {
    if (!data) return;
    const packLang = getDownloadedPack(data.museum.id);
    if (!packLang) return;
    void getCachedAudio(data.museum.id, packLang, data.artifact.ref).then(setCachedUrl);
  }, [data]);

  // A missing photo is fetched from the web once, then stored in the database.
  const triedBackfill = useRef(false);
  useEffect(() => {
    if (!data || data.artifact.image_url || triedBackfill.current) return;
    triedBackfill.current = true;
    void fetch("/api/public/backfill-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ museum_id: data.museum.id }),
    }).catch(() => {});
  }, [data]);

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-warm"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  }
  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm px-6 text-center">
        <h1 className="text-4xl">Artwork not found</h1>
        <Link to="/museum/$slug" params={{ slug }} className="text-primary underline">
          Back to the museum
        </Link>
      </main>
    );
  }

  const { museum, artifact } = data;

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-6 pb-12 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <Link to="/museum/$slug" params={{ slug }} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {museum.name}
        </Link>

        {artifact.image_url && (
          <img src={artifact.image_url} alt={artifact.title} className="mt-6 w-full rounded-3xl object-cover" />
        )}

        <header className="mt-6">
          <h1 className="text-4xl leading-tight">{artifact.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {[artifact.artist, artifact.year].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {artifact.room && (
              <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{artifact.room}</span>
            )}
            <span className="rounded-full bg-secondary px-3 py-1 font-medium text-primary">{artifact.ref}</span>
          </div>
          {artifact.description && (
            <p className="mt-4 leading-relaxed text-muted-foreground">{artifact.description}</p>
          )}
        </header>

        {src === "qr" && museum.is_partner && (
           <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-accent px-5 py-4 text-sm text-accent-foreground">
             <p className="flex items-center gap-2"><QrCode className="h-5 w-5 shrink-0" /> Scanned</p>
             <Button className="min-h-14 whitespace-normal" onClick={() => document.getElementById("ask-guide")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })}><Mic />Ask the guide about this artwork</Button>
           </div>
        )}

        <GuidePlayer artworkId={artifact.id} museumId={museum.id} cachedUrl={cachedUrl} />

        {museum.is_partner && (
           <section id="ask-guide" className="mt-10 scroll-mt-6">
             <AskGuide key={artifact.id} artworkId={artifact.id} museumId={museum.id} artworkTitle={artifact.title} />
          </section>
        )}
         {!museum.is_partner && <div className="mt-10 flex items-start gap-3 border-t pt-6 text-sm text-muted-foreground"><Lock className="h-5 w-5 shrink-0" /><p>Ask the guide — available at partner museums (Pro)</p></div>}
      </div>
    </main>
  );
}
