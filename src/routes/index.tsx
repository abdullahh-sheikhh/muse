import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveLocation } from "@/lib/visitor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Muse — Your AI museum audio guide" },
      { name: "description", content: "Scan, listen, and ask — Muse turns every museum visit into a personal guided tour, in your language." },
      { property: "og:title", content: "Muse — Your AI museum audio guide" },
      { property: "og:description", content: "Scan, listen, and ask — Muse turns every museum visit into a personal guided tour, in your language." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState<"geo" | "city" | null>(null);
  const navigate = useNavigate();

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Your browser can't share your location — search for your city instead.");
      return;
    }
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Near you" });
        navigate({ to: "/museums" });
      },
      () => {
        setBusy(null);
        toast.error("Couldn't get your location — search for your city instead.");
      },
      { timeout: 10000 },
    );
  }

  async function searchCity(e: React.FormEvent) {
    e.preventDefault();
    const q = city.trim();
    if (!q) return;
    setBusy("city");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      );
      const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!results.length) throw new Error("not found");
      const r = results[0];
      saveLocation({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name.split(",")[0] });
      navigate({ to: "/museums" });
    } catch {
      toast.error("City not found — try a nearby larger city.");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),2rem)]">
        <div className="flex items-center gap-2 text-sm font-medium tracking-[0.3em] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" /> MUSE
        </div>
        <h1 className="mt-16 text-6xl leading-[0.95]">
          The museum,
          <br />
          <em className="text-primary">whispered to you.</em>
        </h1>
        <p className="mt-5 text-muted-foreground">
          Point, listen, ask. Muse finds the museums around you and narrates every artwork in your
          language.
        </p>

        <div className="mt-12 space-y-4">
          <Button
            className="h-14 w-full rounded-2xl text-base"
            onClick={useMyLocation}
            disabled={busy !== null}
          >
            {busy === "geo" ? <Loader2 className="animate-spin" /> : <MapPin />}
            Use my location
          </Button>

          <form onSubmit={searchCity} className="rounded-3xl bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4 text-primary" /> Or find your city
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Paris, Lyon, …"
                className="h-12 rounded-xl"
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-12 rounded-xl px-5"
                disabled={busy !== null}
              >
                {busy === "city" ? <Loader2 className="animate-spin" /> : "Go"}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          No account needed — your guide starts instantly.
        </p>
      </div>
    </main>
  );
}
