import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Delete, Settings2, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { lang } from "@/lib/languages";

export const Route = createFileRoute("/m/$slug")({
  head: () => ({
    meta: [
      { title: "Audioguide — ADI" },
      { name: "description", content: "Listen to the museum audioguide in your language." },
      { property: "og:title", content: "Museum audioguide — ADI" },
      { property: "og:description", content: "Listen to the museum audioguide in your language." },
    ],
  }),
  component: Visitor,
});

function Visitor() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["guide", slug],
    queryFn: async () => {
      const { data: museum } = await supabase.from("museums").select("*").eq("slug", slug).maybeSingle();
      if (!museum) return null;
      const [s, a] = await Promise.all([
        supabase.from("stops").select("id, number").eq("museum_id", museum.id),
        supabase.from("stop_audio").select("*").eq("museum_id", museum.id),
      ]);
      return { museum, stops: s.data ?? [], audio: a.data ?? [] };
    },
  });

  const key = `adi-lang-${slug}`;
  const [language, setLanguage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    setLanguage(localStorage.getItem(key));
    setReady(true);
  }, [key]);
  const choose = (l: string) => {
    localStorage.setItem(key, l);
    setLanguage(l);
    setSettings(false);
  };

  if (q.isLoading || !ready) return <div className="min-h-screen bg-warm" />;
  if (!q.data)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm p-6 text-center">
        <h1 className="text-4xl">Guide not found</h1>
        <p className="text-muted-foreground">Check the museum code and try again.</p>
        <Button asChild variant="outline"><Link to="/">Back</Link></Button>
      </main>
    );

  const { museum } = q.data;
  const valid = language && museum.languages.includes(language);

  if (!valid) return <LanguagePicker name={museum.name} languages={museum.languages} onPick={choose} />;

  return (
    <>
      <Keypad data={q.data} language={language!} onSettings={() => setSettings(true)} />
      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display text-3xl font-normal">Language</SheetTitle>
          </SheetHeader>
          <LanguageList languages={museum.languages} current={language!} onPick={choose} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function LanguageList({ languages, current, onPick }: { languages: string[]; current?: string; onPick: (l: string) => void }) {
  return (
    <div className="grid gap-2 p-4">
      {languages.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-lg transition active:scale-[0.98] ${current === c ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
        >
          <span className="text-2xl">{lang(c).flag}</span> {lang(c).name}
        </button>
      ))}
    </div>
  );
}

function LanguagePicker({ name, languages, onPick }: { name: string; languages: string[]; onPick: (l: string) => void }) {
  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-2 pt-[max(env(safe-area-inset-top),2.5rem)]">
        <div className="px-4">
          <div className="text-sm tracking-[0.3em] text-muted-foreground">ADI</div>
          <h1 className="mt-6 text-5xl leading-none">{name}</h1>
          <p className="mt-3 text-muted-foreground">Choose your language · Choisissez votre langue</p>
        </div>
        <LanguageList languages={languages} onPick={onPick} />
      </div>
    </main>
  );
}

type GuideData = {
  museum: { name: string; intro: string };
  stops: { id: string; number: number }[];
  audio: { id: string; stop_id: string; language: string; title: string; body: string; updated_at: string }[];
};

function Keypad({ data, language, onSettings }: { data: GuideData; language: string; onSettings: () => void }) {
  const [digits, setDigits] = useState("");
  const [current, setCurrent] = useState<GuideData["audio"][number] | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  function play() {
    setError("");
    const stop = data.stops.find((s) => s.number === Number(digits));
    if (!stop) return setError(`No stop ${digits}`);
    const a = data.audio.find((x) => x.stop_id === stop.id && x.language === language);
    if (!a) return setError("Not available in this language yet");
    setCurrent(a);
    setDigits("");
  }

  useEffect(() => {
    if (current) audioRef.current?.play().catch(() => {});
  }, [current]);

  const press = (d: string) => {
    setError("");
    setDigits((v) => (v + d).slice(0, 4));
  };

  return (
    <main className="flex min-h-screen flex-col bg-warm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="flex items-center justify-between">
          <h1 className="truncate text-2xl">{data.museum.name}</h1>
          <Button variant="ghost" onClick={onSettings} aria-label="Settings">
            <span className="text-lg">{lang(language).flag}</span>
            <Settings2 />
          </Button>
        </header>
        {data.museum.intro && !current && <p className="mt-2 text-sm text-muted-foreground">{data.museum.intro}</p>}

        {current && (
          <section className="mt-5 rounded-3xl bg-ink p-5 text-ink-foreground shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-3xl leading-tight">{current.title}</h2>
              <button onClick={() => setCurrent(null)} aria-label="Close" className="opacity-70"><X /></button>
            </div>
            <audio
              ref={audioRef}
              className="mt-4 w-full"
              controls
              src={`/api/public/audio/${current.id}?v=${current.updated_at}`}
            />
            <details className="mt-3 text-sm opacity-80">
              <summary className="cursor-pointer">Read the text</summary>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{current.body}</p>
            </details>
          </section>
        )}

        <div className="mt-auto pt-6">
          <div className="flex h-24 items-center justify-center font-display text-7xl tabular-nums">
            {digits || <span className="text-muted-foreground/40">—</span>}
          </div>
          <p className="h-5 text-center text-sm text-destructive">{error}</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeyButton key={d} onClick={() => press(d)}>{d}</KeyButton>
            ))}
            <KeyButton onClick={() => setDigits((v) => v.slice(0, -1))} aria-label="Delete"><Delete /></KeyButton>
            <KeyButton onClick={() => press("0")}>0</KeyButton>
            <button
              onClick={play}
              disabled={!digits}
              aria-label="Play"
              className="flex h-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-soft transition active:scale-95 disabled:opacity-40"
            >
              <Play className="h-8 w-8" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function KeyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex h-20 items-center justify-center rounded-3xl bg-card font-display text-4xl shadow-soft transition active:scale-95"
    />
  );
}
