import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Language } from "@elevenlabs/client";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ensureVisitor, getPreferredLanguage, logEvent } from "@/lib/visitor";
import { startAgentSession } from "@/lib/agent.functions";
import { isRtl } from "@/lib/guide-languages";
import { SESSION_SECONDS } from "@/lib/agent-rules";
import helios from "@/assets/helios.png";

type Props = { artworkId: string; museumId: string; artworkTitle: string };

export function AskGuide(props: Props) {
  return <ConversationProvider><LiveGuide {...props} /></ConversationProvider>;
}

function LiveGuide({ artworkId, museumId, artworkTitle }: Props) {
  const start = useServerFn(startAgentSession);
  const [state, setState] = useState<"idle" | "mic" | "connecting" | "active" | "ended" | "error">("idle");
  const [explainer, setExplainer] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("en");
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [captions, setCaptions] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const visitorId = useRef<string | null>(null);
  const sessionLogged = useRef(false);
  const mounted = useRef(true);
  const deadline = useRef(0);
  const generation = useRef(0);
  const seen = useRef(new Set<string>());
  const writeQueue = useRef(Promise.resolve());
  const conversation = useConversation({
    onConnect: () => { deadline.current = Date.now() + SESSION_SECONDS * 1000; setRemaining(SESSION_SECONDS); setState("active"); },
    onDisconnect: () => {
      if (sessionLogged.current) { sessionLogged.current = false; void logEvent("agent_end", museumId, artworkId); }
      if (mounted.current) setState((previous) => previous === "error" ? "error" : "ended");
    },
    onError: () => { if (mounted.current) { setError("Couldn't connect, try again"); setState("error"); } },
    onMessage: (message) => {
      if (!message.message.trim()) return;
      const key = `${message.role}:${message.event_id}:${message.response_id ?? ""}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const role = message.role;
      setCaptions((previous) => [...previous, { role, text: message.message }].slice(-6));
      let conversationId = "";
      try { conversationId = conversation.getId(); } catch { /* metadata may arrive first */ }
      const id = conversationId;
      writeQueue.current = writeQueue.current.then(async () => {
        const { error: saveError } = await supabase.from("agent_messages").insert({ museum_id: museumId, artwork_id: artworkId, visitor_id: visitorId.current, conversation_id: id || null, role, text: message.message, language });
        if (saveError) toast.error("Couldn't save this conversation turn");
      }).catch(() => { toast.error("Couldn't save this conversation turn"); });
      if (role === "user") void logEvent("question", museumId, artworkId);
    },
  });
  const endRef = useRef(conversation.endSession);
  endRef.current = conversation.endSession;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; generation.current += 1;
      endRef.current();
      if (sessionLogged.current) { sessionLogged.current = false; void logEvent("agent_end", museumId, artworkId); }
    };
  }, [artworkId, museumId]);

  useEffect(() => {
    if (state !== "active") return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) endRef.current();
    }, 500);
    return () => window.clearInterval(timer);
  }, [state]);

  async function connect() {
    setExplainer(false); setError(""); setCaptions([]); seen.current.clear();
    const attempt = ++generation.current;
    try {
      setState("mic");
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Microphone unavailable", "NotAllowedError");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      if (!mounted.current || generation.current !== attempt) return;
      localStorage.setItem("muse-mic-explained", "yes");
      const visitor = await ensureVisitor();
      if (!visitor) throw new Error("Couldn't sign in to the guide, try again");
      visitorId.current = visitor.id;
      const lang = getPreferredLanguage(); setLanguage(lang);
      setState("connecting");
      const session = await start({ data: { artworkId, language: lang } });
      if (!mounted.current || generation.current !== attempt) { void logEvent("agent_end", museumId, artworkId); return; }
      sessionLogged.current = true;
      document.querySelectorAll("audio").forEach((audio) => audio.pause());
      window.speechSynthesis?.cancel();
      conversation.setMuted(false);
      conversation.startSession({ signedUrl: session.signedUrl, connectionType: "websocket", dynamicVariables: session.dynamicVariables, overrides: { agent: { language: session.language as Language, firstMessage: session.firstMessage } } });
    } catch (failure) {
      if (!mounted.current) return;
      const denied = failure instanceof DOMException && ["NotAllowedError", "PermissionDeniedError", "NotFoundError"].includes(failure.name);
      setError(denied ? "Allow microphone access to talk to the guide. In your browser’s site settings, allow Microphone, then try again." : failure instanceof Error ? failure.message : "Couldn't connect, try again");
      setState("error");
      if (sessionLogged.current) { sessionLogged.current = false; void logEvent("agent_end", museumId, artworkId); }
    }
  }

  const busy = state === "mic" || state === "connecting";
  const active = state === "active";
  return <div className="flex flex-col items-center gap-4" aria-label={`Ask the guide about ${artworkTitle}`}>
    <h2 className="text-3xl">Ask the guide</h2>
    {active ? <>
      <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-primary/15 text-primary ${conversation.isSpeaking ? "motion-safe:animate-pulse" : "motion-safe:animate-[pulse_3s_ease-in-out_infinite]"}`}><img src={helios} alt="" width={96} height={96} className="h-16 w-16 object-contain" /></div>
      <p className="text-sm text-primary" role="status">{conversation.isSpeaking ? "Your guide is speaking" : conversation.isMuted ? "Microphone muted" : "Listening"} · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>
      <ol className="flex max-h-80 w-full flex-col gap-3 overflow-y-auto" aria-live="polite" dir={isRtl(language) ? "rtl" : "ltr"}>
        {captions.map((caption, index) => <li key={index} className={`max-w-[90%] break-words rounded-lg px-4 py-3 text-sm ${caption.role === "user" ? "self-end bg-secondary text-secondary-foreground" : "self-start bg-accent text-accent-foreground"}`}><span className="mb-1 block text-xs font-medium">{caption.role === "user" ? "You" : "Guide"}</span>{caption.text}</li>)}
      </ol>
      <div className="flex w-full gap-3">
        <Button variant="outline" className="h-14 flex-1" aria-pressed={conversation.isMuted} onClick={() => conversation.setMuted(!conversation.isMuted)}>{conversation.isMuted ? <MicOff /> : <Mic />}{conversation.isMuted ? "Unmute" : "Mute mic"}</Button>
        <Button variant="destructive" className="h-14 flex-1" onClick={() => conversation.endSession()}><PhoneOff />End</Button>
      </div>
    </> : <>
      <Button variant="outline" className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary bg-card text-primary" aria-label={state === "ended" ? "Talk again" : "Talk to your guide"} disabled={busy} onClick={() => localStorage.getItem("muse-mic-explained") === "yes" ? void connect() : setExplainer(true)}>{busy ? <Loader2 className="h-9 w-9 animate-spin" /> : <img src={helios} alt="AI guide" loading="lazy" width={96} height={96} className="h-16 w-16 object-contain" />}</Button>
      <p role="status" className="text-center text-sm">{state === "mic" ? "Requesting microphone…" : state === "connecting" ? "Connecting…" : state === "ended" ? "Conversation ended" : "Talk to your guide"}</p>
      {state === "ended" && <Button variant="link" onClick={() => void connect()}>Talk again</Button>}
      <p className="text-xs text-muted-foreground">Pro · voice guide · ask anything</p>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
    </>}
    <Dialog open={explainer} onOpenChange={setExplainer}><DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md"><DialogTitle>Talk to your guide</DialogTitle><DialogDescription>Muse will listen through your microphone while this is open. Nothing is recorded after you end.</DialogDescription><Button className="h-14" onClick={() => void connect()}><Mic />Continue</Button></DialogContent></Dialog>
  </div>;
}
