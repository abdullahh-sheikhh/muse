import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Headphones, Landmark, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/languages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADI — Audioguides for museums, made simple" },
      { name: "description", content: "Write once, ADI voices and translates your museum audioguide for every visitor." },
      { property: "og:title", content: "ADI — Audioguides for museums" },
      { property: "og:description", content: "Write once, ADI voices and translates your museum audioguide for every visitor." },
    ],
  }),
  component: Index,
});

function Index() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),2rem)]">
        <div className="flex items-center gap-2 text-sm font-medium tracking-[0.3em] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" /> ADI
        </div>
        <h1 className="mt-16 text-6xl leading-[0.95]">
          Every artwork,<br />
          <em className="text-primary">in every voice.</em>
        </h1>
        <p className="mt-5 text-muted-foreground">
          Museums write the story once. ADI narrates and translates it for each visitor.
        </p>

        <form
          className="mt-12 rounded-3xl bg-card p-5 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            const s = slugify(code);
            if (s) navigate({ to: "/m/$slug", params: { slug: s } });
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Headphones className="h-4 w-4 text-primary" /> I'm visiting
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Museum code"
              className="h-12 rounded-xl"
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" aria-label="Open guide">
              <ArrowRight />
            </Button>
          </div>
        </form>

        <div className="mt-auto pt-10">
          <Button asChild variant="ink" className="h-14 w-full rounded-2xl text-base">
            <Link to="/studio">
              <Landmark /> I run a museum
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
