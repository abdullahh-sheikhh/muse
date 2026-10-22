import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, BadgeCheck, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadLocation, type VisitorLocation } from "@/lib/visitor";

export const Route = createFileRoute("/museums")({
  head: () => ({
    meta: [
      { title: "Museums near you — Muse" },
      { name: "description", content: "Museums near you with AI audio guides." },
      { property: "og:title", content: "Museums near you — Muse" },
      { property: "og:description", content: "Museums near you with AI audio guides." },
    ],
  }),
  component: MuseumsPage,
});

type NearbyMuseum = {
  id: string;
  name: string;
  slug: string;
  city: string;
  image_url: string | null;
  is_partner: boolean;
  distance_km: number;
};

function MuseumsPage() {
  const [loc, setLoc] = useState<VisitorLocation | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = loadLocation();
    if (!saved) navigate({ to: "/" });
    else setLoc(saved);
  }, [navigate]);

  const { data: museums, isLoading } = useQuery({
    queryKey: ["nearby-museums", loc?.lat, loc?.lng],
    enabled: !!loc,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_museums", {
        _lat: loc!.lat,
        _lng: loc!.lng,
        _radius_km: 25,
      });
      if (error) throw error;
      return (data ?? []) as NearbyMuseum[];
    },
  });

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-md px-6 pb-10 pt-[max(env(safe-area-inset-top),2rem)]">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl">Near you</h1>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {loc?.label ?? "…"}
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {isLoading && <p className="text-muted-foreground">Looking for museums…</p>}
          {museums?.length === 0 && (
            <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
              <Landmark className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No museums within 25 km yet. Try another city.
              </p>
            </div>
          )}
          {museums?.map((m) => (
            <Link
              key={m.id}
              to="/museum/$slug"
              params={{ slug: m.slug }}
              className="flex gap-4 rounded-3xl bg-card p-4 shadow-soft transition-transform active:scale-[0.98]"
            >
              {m.image_url ? (
                <img
                  src={m.image_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-secondary font-display text-4xl text-primary">
                  {m.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-2xl leading-tight">{m.name}</h2>
                  {m.is_partner && (
                    <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      <BadgeCheck className="h-3 w-3" /> Pro guide
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {m.city} · {m.distance_km < 1 ? `${Math.round(m.distance_km * 1000)} m` : `${m.distance_km.toFixed(1)} km`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
