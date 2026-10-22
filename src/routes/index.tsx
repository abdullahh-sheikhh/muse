import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { saveLocation } from "@/lib/visitor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [step, setStep] = useState<"country" | "city" | "museum">("country");
  const [busy, setBusy] = useState<"geo" | null>(null);
  const navigate = useNavigate();

  const { data: all = [] } = useQuery({
    queryKey: ["museum-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("museums")
        .select("name, slug, city, country, image_url")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countries = [...new Set(all.map((m) => m.country).filter(Boolean))].sort();
  const cities = [...new Set(all.filter((m) => m.country === country).map((m) => m.city).filter(Boolean))].sort();
  const cityMuseums = all.filter((m) => m.country === country && m.city === city);
  const rows =
    step === "country"
      ? countries.map((c) => ({ label: c, image: null as string | null }))
      : step === "city"
        ? cities.map((c) => ({ label: c, image: null as string | null }))
        : cityMuseums.map((m) => ({ label: m.name, image: m.image_url }));

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
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
              {(["country", "city", "museum"] as const).map((s, i) => {
                const enabled = s === "country" || (s === "city" && !!country) || (s === "museum" && !!city);
                const label = s === "country" ? country || "Country" : s === "city" ? city || "City" : "Museum";
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setStep(s)}
                    className={`truncate rounded-xl px-2 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                      step === s ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
                    }`}
                  >
                    <span className="mr-1 opacity-60">{i + 1}.</span>
                    {label}
                  </button>
                );
              })}
            </div>
            <ul
              key={step}
              className="mt-4 max-h-80 space-y-2 overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {rows.map((row, idx) => {
                const selected =
                  (step === "country" && row.label === country) || (step === "city" && row.label === city);
                return (
                  <li key={row.label + idx}>
                    <button
                      type="button"
                      onClick={() => {
                        if (step === "country") {
                          setCountry(row.label);
                          setCity("");
                          setStep("city");
                        } else if (step === "city") {
                          setCity(row.label);
                          setStep("museum");
                        } else {
                          navigate({ to: "/museum/$slug", params: { slug: cityMuseums[idx]!.slug } });
                        }
                      }}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left text-lg font-display transition-all active:scale-[0.98] ${
                        selected ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                    >
                      {row.image ? (
                        <img
                          src={row.image}
                          alt=""
                          loading="lazy"
                          onError={(e) => e.currentTarget.classList.add("hidden")}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{row.label}</span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          No account needed — your guide starts instantly.
        </p>
      </div>
    </main>
  );
}
