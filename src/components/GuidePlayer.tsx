import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Pause, Play, RotateCcw, RotateCw, Volume2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GUIDE_LANGUAGES, isRtl, nativeName, toLanguageTag } from "@/lib/guide-languages";
import { getPreferredLanguage, logEvent, setPreferredLanguage } from "@/lib/visitor";

type Guide = { script_text: string; audio_url: string | null; sources: { title: string; url: string | null }[] };

export function GuidePlayer({
  artworkId,
  museumId,
  cachedUrl,
}: {
  artworkId: string;
  museumId: string;
  cachedUrl: string | null;
}) {
  const [language, setLanguage] = useState("en");
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setLanguage(getPreferredLanguage()), []);

  const src = guide?.audio_url ?? (guide ? null : cachedUrl);

  async function load(lang: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/public/artwork-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artwork_id: artworkId, language: lang }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as Guide & { ok: boolean };
      if (!json.ok) throw new Error();
      setGuide(json);
      logEvent("play", museumId, artworkId);
      if (json.audio_url) setTimeout(() => void audioRef.current?.play(), 50);
    } catch {
      toast.error("Couldn't create the audio guide. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function onPlay() {
    if (src && audioRef.current) {
      if (playing) audioRef.current.pause();
      else void audioRef.current.play();
      return;
    }
    if (!guide) await load(language);
  }

  function changeLanguage(code: string) {
    setLanguage(code);
    void setPreferredLanguage(code);
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (guide || cachedUrl) {
      setGuide(null);
      void load(code);
    }
  }

  function readAloud() {
    if (!guide || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(guide.script_text);
    u.lang = language;
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  const seek = (d: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const rtl = isRtl(language);
  const selectValue = GUIDE_LANGUAGES.some((l) => l.code === language) && !other ? language : "__other";

  return (
    <section className="mt-8 rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Audio guide</h2>
        <select
          aria-label="Guide language"
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === "__other") setOther(true);
            else {
              setOther(false);
              changeLanguage(e.target.value);
            }
          }}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          {GUIDE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
          <option value="__other">
            {selectValue === "__other" && !other ? nativeName(language) : "Other…"}
          </option>
        </select>
      </div>

      {other && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const tag = toLanguageTag(otherText);
            if (!tag) {
              toast.error("Unknown language — try a name like “Polish” or a code like “pl”.");
              return;
            }
            setOther(false);
            changeLanguage(tag);
          }}
        >
          <Input value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="e.g. Polish or pl" className="h-11 rounded-xl" />
          <Button type="submit" className="h-11 rounded-xl">Use</Button>
        </form>
      )}

      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />

      <div className="mt-5 flex items-center justify-center gap-4">
        {src && (
          <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={() => seek(-10)} aria-label="Back 10 seconds">
            <RotateCcw />
          </Button>
        )}
        <Button
          className="h-16 min-w-16 rounded-full px-6 text-base"
          onClick={onPlay}
          disabled={loading || (!!guide && !guide.audio_url)}
          aria-label={playing ? "Pause" : "Play the guide"}
        >
          {loading ? <Loader2 className="animate-spin" /> : playing ? <Pause /> : <Play />}
          {!src && !loading && !guide && "Play the guide"}
        </Button>
        {src && (
          <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={() => seek(10)} aria-label="Forward 10 seconds">
            <RotateCw />
          </Button>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Your guide is preparing in {nativeName(language)}…
        </p>
      )}

      {src && (
        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
            }}
            className="w-full accent-primary"
            aria-label="Progress"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      )}

      {guide && !guide.audio_url && (
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">Voice unavailable, showing text</p>
          <Button variant="secondary" className="mt-2 h-12 rounded-xl" onClick={readAloud}>
            <Volume2 /> {speaking ? "Stop reading" : "Read aloud"}
          </Button>
        </div>
      )}

      {guide && (
        <div className="mt-5 border-t border-border pt-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-3">
            <span className="font-medium">Transcript</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${open || !guide.audio_url ? "rotate-180" : ""}`} />
          </button>
          {(open || !guide.audio_url) && (
            <p dir={rtl ? "rtl" : "ltr"} lang={language} className="whitespace-pre-line pb-3 text-sm leading-relaxed text-muted-foreground">
              {guide.script_text}
            </p>
          )}
        </div>
      )}

      {guide && guide.sources.length > 0 && (
        <div className="mt-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 font-medium">
            <BookOpen className="h-4 w-4 text-primary" /> Sources
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {guide.sources.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-primary underline">{s.title}</a>
                ) : (
                  s.title
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
