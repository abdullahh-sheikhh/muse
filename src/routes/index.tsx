import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState<"geo" | null>(null);
  const navigate = useNavigate();

  const { data: all = [] } = useQuery({
    queryKey: ["museum-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("museums")
        .select("name, slug, city, country")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countries = [...new Set(all.map((m) => m.country).filter(Boolean))].sort();
  const cities = [...new Set(all.filter((m) => m.country === country).map((m) => m.city).filter(Boolean))].sort();
  const cityMuseums = all.filter((m) => m.country === country && m.city === city);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Your browser can't share your location — choose a museum below instead.");
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
        toast.error("Couldn't get your location — choose a museum below instead.");
      },
      { timeout: 10000 },
    );
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

          <div className="rounded-3xl bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4 text-primary" /> Or choose a museum
            </div>
            <div className="mt-3 space-y-3">
              <select
                aria-label="Country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCity("");
                }}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base"
              >
                <option value="">Select a country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="City"
                value={city}
                disabled={!country}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base disabled:opacity-50"
              >
                <option value="">Select a city</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Museum"
                value=""
                disabled={!city}
                onChange={(e) => e.target.value && navigate({ to: "/museum/$slug", params: { slug: e.target.value } })}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base disabled:opacity-50"
              >
                <option value="">Select a museum</option>
                {cityMuseums.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          No account needed — your guide starts instantly.
        </p>
      </div>
    </main>
  );
}
