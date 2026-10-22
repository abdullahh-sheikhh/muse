import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Sparkles, Trash2, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useAuth";
import { generateStopAudio } from "@/lib/audio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, lang } from "@/lib/languages";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/studio/$museumId")({
  head: () => ({
    meta: [
      { title: "Edit audioguide — ADI Studio" },
      { name: "description", content: "Write stops, pick languages and generate narrated audio." },
      { property: "og:title", content: "Edit audioguide — ADI Studio" },
      { property: "og:description", content: "Write stops, pick languages and generate narrated audio." },
    ],
  }),
  component: MuseumEditor,
});

function MuseumEditor() {
  const { museumId } = Route.useParams();
  const user = useRequireAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["museum", museumId],
    enabled: !!user,
    queryFn: async () => {
      const [m, s, a] = await Promise.all([
        supabase.from("museums").select("*").eq("id", museumId).single(),
        supabase.from("stops").select("*").eq("museum_id", museumId).order("number"),
        supabase.from("stop_audio").select("*").eq("museum_id", museumId),
      ]);
      if (m.error) throw m.error;
      return { museum: m.data, stops: s.data ?? [], audio: a.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["museum", museumId] });

  if (!user || !q.data) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const { museum, stops, audio } = q.data;
  const nextNumber = (stops.at(-1)?.number ?? 0) + 1;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <Link to="/studio" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Museums
        </Link>
        <h1 className="mt-4 text-5xl">{museum.name}</h1>
        <MuseumSettings museum={museum} onSaved={refresh} />

        <h2 className="mt-12 text-3xl">Stops</h2>
        <p className="text-sm text-muted-foreground">
          Visitors type the number on the keypad. Write in {lang(museum.source_language).english}; ADI translates and narrates.
        </p>
        <div className="mt-5 space-y-4">
          {stops.map((s) => (
            <StopCard key={s.id} stop={s} museum={museum} audio={audio.filter((a) => a.stop_id === s.id)} onChange={refresh} />
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-4 h-12 w-full rounded-2xl border-dashed"
          onClick={async () => {
            const { error } = await supabase.from("stops").insert({ museum_id: museum.id, number: nextNumber, title: `Stop ${nextNumber}` });
            if (error) toast.error(error.message);
            refresh();
          }}
        >
          <Plus /> Add stop {nextNumber}
        </Button>
      </div>
    </main>
  );
}

function MuseumSettings({ museum, onSaved }: { museum: Tables<"museums">; onSaved: () => void }) {
  const [name, setName] = useState(museum.name);
  const [intro, setIntro] = useState(museum.intro);
  const [langs, setLangs] = useState<string[]>(museum.languages);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${window.location.origin}/m/${museum.slug}`), [museum.slug]);

  async function save() {
    const languages = Array.from(new Set([museum.source_language, ...langs]));
    const { error } = await supabase.from("museums").update({ name, intro, languages }).eq("id", museum.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <section className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
        <span className="text-muted-foreground">Visitor code</span>
        <strong className="font-mono">{museum.slug}</strong>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} Copy visitor link
        </Button>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Museum name" />
      <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Short welcome message for visitors (optional)" rows={2} />
      <div>
        <div className="mb-2 text-sm font-medium">Languages offered to visitors</div>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const on = langs.includes(l.code) || l.code === museum.source_language;
            return (
              <button
                key={l.code}
                type="button"
                disabled={l.code === museum.source_language}
                onClick={() => setLangs(on ? langs.filter((c) => c !== l.code) : [...langs, l.code])}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {l.flag} {l.name}
              </button>
            );
          })}
        </div>
      </div>
      <Button onClick={save}>Save settings</Button>
    </section>
  );
}

function StopCard({
  stop,
  museum,
  audio,
  onChange,
}: {
  stop: Tables<"stops">;
  museum: Tables<"museums">;
  audio: Tables<"stop_audio">[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState(stop.title);
  const [body, setBody] = useState(stop.body);
  const [number, setNumber] = useState(String(stop.number));
  const [working, setWorking] = useState<string | null>(null);
  const dirty = title !== stop.title || body !== stop.body || number !== String(stop.number);

  async function save() {
    const { error } = await supabase.from("stops").update({ title, body, number: Number(number) }).eq("id", stop.id);
    if (error) {
      toast.error(error.code === "23505" ? "That number is already used" : error.message);
      return false;
    }
    onChange();
    return true;
  }

  async function generate() {
    if (dirty && !(await save())) return;
    if (!body.trim()) return toast.error("Write the text first");
    for (const l of museum.languages) {
      setWorking(l);
      try {
        await generateStopAudio({ data: { stopId: stop.id, language: l } });
      } catch (e) {
        toast.error(`${lang(l).english}: ${e instanceof Error ? e.message : "failed"}`);
        break;
      }
    }
    setWorking(null);
    onChange();
    toast.success("Audio ready");
  }

  const stale = (a: Tables<"stop_audio">) => new Date(a.updated_at) < new Date(stop.created_at);

  return (
    <article className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex gap-3">
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
          className="h-14 w-20 text-center font-display text-3xl"
          aria-label="Stop number"
        />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-14 font-display text-2xl" aria-label="Title" />
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="mt-3"
        placeholder="What should visitors hear about this artwork?"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {museum.languages.map((l) => {
          const a = audio.find((x) => x.language === l);
          return (
            <span
              key={l}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${a && !stale(a) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {working === l ? <Loader2 className="h-3 w-3 animate-spin" /> : lang(l).flag} {lang(l).english}
              {a ? "" : " · no audio"}
            </span>
          );
        })}
      </div>
      {audio.find((a) => a.language === museum.source_language) && (
        <audio
          className="mt-3 w-full"
          controls
          preload="none"
          src={`/api/public/audio/${audio.find((a) => a.language === museum.source_language)!.id}?v=${audio.find((a) => a.language === museum.source_language)!.updated_at}`}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={generate} disabled={!!working}>
          {working ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {working ? `Generating ${lang(working).english}…` : "Generate audio in all languages"}
        </Button>
        {dirty && <Button variant="outline" onClick={save}>Save</Button>}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Delete stop"
          onClick={async () => {
            if (!confirm("Delete this stop?")) return;
            await supabase.from("stops").delete().eq("id", stop.id);
            onChange();
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}
