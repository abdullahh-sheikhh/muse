import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES, slugify } from "@/lib/languages";

export const Route = createFileRoute("/studio/")({
  head: () => ({
    meta: [
      { title: "Your museums — ADI Studio" },
      { name: "description", content: "Manage your museum audioguides." },
      { property: "og:title", content: "ADI Studio" },
      { property: "og:description", content: "Manage your museum audioguides." },
    ],
  }),
  component: Studio,
});

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);
  return user;
}

function Studio() {
  const user = useRequireAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [source, setSource] = useState("fr");
  const museums = useQuery({
    queryKey: ["museums", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("museums").select("*").eq("owner_id", user!.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("museums").insert({
      owner_id: user.id,
      name: name.trim(),
      slug,
      source_language: source,
      languages: Array.from(new Set([source, "en", "fr"])),
    });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["museums"] });
  }

  if (!user) return null;
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-10">
        <header className="flex items-center justify-between">
          <span className="text-sm tracking-[0.3em] text-muted-foreground">ADI STUDIO</span>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Sign out
          </Button>
        </header>
        <h1 className="mt-8 text-5xl">Your museums</h1>

        <div className="mt-8 space-y-3">
          {museums.data?.map((m) => (
            <Link
              key={m.id}
              to="/studio/$museumId"
              params={{ museumId: m.id }}
              className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-soft transition hover:-translate-y-0.5"
            >
              <div>
                <div className="font-display text-2xl">{m.name}</div>
                <div className="text-sm text-muted-foreground">Code: {m.slug} · {m.languages.length} languages</div>
              </div>
              <ChevronRight className="text-muted-foreground" />
            </Link>
          ))}
          {museums.data?.length === 0 && (
            <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              No museum yet. Create your first one below.
            </p>
          )}
        </div>

        <form onSubmit={create} className="mt-8 rounded-2xl bg-secondary p-5">
          <div className="text-sm font-medium">New museum</div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Museum name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 bg-card" />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-11 rounded-md border border-input bg-card px-3 text-sm"
              aria-label="Writing language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>Write in {l.english}</option>
              ))}
            </select>
            <Button type="submit" className="h-11"><Plus /> Create</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
