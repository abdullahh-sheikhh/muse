import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, Loader2, ChevronDown, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AskGuide } from "@/components/AskGuide";
import { getCachedAudio, getDownloadedPack, getPreferredLanguage, logEvent } from "@/lib/visitor";

export const Route = createFileRoute("/museum/$slug_/artifact/$ref")({
  head: () => ({
    meta: [
      { title: "Artwork — Muse" },
      { name: "description", content: "Listen to the story of this artwork." },
      { property: "og:title", content: "Artwork — Muse" },
      { property: "og:description", content: "Listen to the story of this artwork." },
    ],
  }),
  component: ArtifactPage,
});

function ArtifactPage() {
  const { slug, ref } = Route.useParams();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      const { data: facts } = await supabase
        .from("artwork_facts")
        .select("id, label, source_url")
        .eq("artwork_id", artifact.id)
        .order("sort_order");
      return { museum, artifact, facts: facts ?? [] };
    },
  });

  useEffect(() => {
    if (data) logEvent("open", data.museum.id, data.artifact.id);
  }, [data]);

  // If a pack was downloaded for this museum, try the cached file first.
  useEffect(() => {
    if (!data) return;
    const packLang = getDownloadedPack(data.museum.id);
    if (!packLang) return;
    void getCachedAudio(data.museum.id, packLang, data.artifact.ref).then((url) => {
      if (url) setAudioUrl(url);
    });
  }, [data]);

  async function playGuide() {
    if (!data) return;
    if (audioUrl) {
      void audioRef.current?.play();
      return;
    }
    setLoadingAudio(true);
    try {
      const res = await fetch("/api/public/artwork-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artwork_id: data.artifact.id, language: getPreferredLanguage() }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { script_text: string; audio_url: string };
      setScript(json.script_text);
      setAudioUrl(json.audio_url);
      logEvent("play", data.museum.id, data.artifact.id);
      // Play after the tap that triggered generation.
      setTimeout(() => void audioRef.current?.play(), 50);
    } catch {
      toast.error("Couldn't create the audio guide. Try again in a moment.");
    } finally {
      setLoadingAudio(false);
    }
  }

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

  const { museum, artifact, facts } = data;

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-6 pb-12 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <Link
          to="/museum/$slug"
          params={{ slug }}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {museum.name}
        </Link>

        {artifact.image_url ? (
          <img
            src={artifact.image_url}
            alt={artifact.title}
            className="mt-6 w-full rounded-3xl object-cover"
          />
        ) : (
          <div className="mt-6 flex h-64 w-full items-center justify-center rounded-3xl bg-secondary font-display text-8xl text-primary">
            {artifact.title.charAt(0)}
          </div>
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
        </header>

        <section className="mt-8">
          <audio ref={audioRef} src={audioUrl ?? undefined} controls={!!audioUrl} className={audioUrl ? "w-full" : "hidden"} />
          {!audioUrl && (
            <Button className="h-14 w-full rounded-2xl text-base" onClick={playGuide} disabled={loadingAudio}>
              {loadingAudio ? <Loader2 className="animate-spin" /> : <Play />}
              {loadingAudio ? "Preparing your guide…" : "Play the guide"}
            </Button>
          )}
        </section>

        {script && (
          <section className="mt-6 rounded-3xl bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <span className="font-medium">Transcript</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${transcriptOpen ? "rotate-180" : ""}`} />
            </button>
            {transcriptOpen && (
              <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {script}
              </p>
            )}
          </section>
        )}

        {facts.length > 0 && (
          <section className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" /> Sources
            </h2>
            <ul className="mt-3 space-y-3">
              {facts.map((f) => (
                <li key={f.id} className="text-sm text-muted-foreground">
                  {f.label}
                  {f.source_url && (
                    <>
                      {" "}
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Source
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {museum.is_partner && (
          <section className="mt-10">
            <AskGuide />
          </section>
        )}
      </div>
    </main>
  );
}
