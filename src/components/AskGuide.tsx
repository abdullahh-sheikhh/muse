import { useState } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

/**
 * Placeholder for the ElevenLabs conversational "Ask the guide" feature.
 * Renders the final hold-to-talk UI; the live agent session lands later.
 */
export function AskGuide() {
  const [held, setHeld] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        aria-label="Hold to ask the guide"
        onPointerDown={() => setHeld(true)}
        onPointerUp={() => {
          setHeld(false);
          toast("Ask the guide is coming soon — hold to talk once it launches.");
        }}
        onPointerLeave={() => setHeld(false)}
        className={`flex h-24 w-24 items-center justify-center rounded-full border-2 transition-all ${
          held
            ? "scale-95 border-primary bg-primary text-primary-foreground"
            : "border-primary/60 bg-card text-primary"
        }`}
      >
        <Mic className="h-9 w-9" />
      </button>
      <p className="text-sm text-muted-foreground">Hold to ask the guide</p>
    </div>
  );
}
