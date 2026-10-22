import { useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeSpokenRef } from "@/lib/spoken-ref";

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

/** Hold to speak an inventory number; releases call /api/public/transcribe. */
export function RefMicButton({
  onResult,
  onFail,
}: {
  onResult: (ref: string, languageCode: string) => void;
  onFail: () => void;
}) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const fail = () => {
    toast.error("Couldn't hear that — please type the number");
    setState("idle");
    onFail();
  };

  async function start(e: React.PointerEvent) {
    e.preventDefault();
    if (state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || "audio/mp4" });
        if (blob.size < 500) return fail();
        setState("busy");
        try {
          const fd = new FormData();
          fd.append("file", blob, blob.type.includes("webm") ? "clip.webm" : "clip.m4a");
          const res = await fetch("/api/public/transcribe", { method: "POST", body: fd });
          const json = (await res.json()) as { ok: boolean; text?: string; language_code?: string };
          const ref = json.ok && json.text ? normalizeSpokenRef(json.text) : "";
          if (!ref) return fail();
          setState("idle");
          onResult(ref, json.language_code ?? "");
        } catch {
          fail();
        }
      };
      r.start();
      rec.current = r;
      setState("rec");
    } catch {
      fail();
    }
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
    rec.current = null;
  }

  return (
    <button
      type="button"
      aria-label="Hold to say the number"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={`absolute right-1 top-1 flex h-10 w-10 touch-none select-none items-center justify-center rounded-lg ${
        state === "rec" ? "bg-destructive text-destructive-foreground animate-pulse" : "text-muted-foreground"
      }`}
    >
      {state === "busy" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
