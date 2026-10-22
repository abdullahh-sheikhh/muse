import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ADI Studio" },
      { name: "description", content: "Sign in to create and manage your museum audioguides." },
      { property: "og:title", content: "Sign in — ADI Studio" },
      { property: "og:description", content: "Sign in to create and manage your museum audioguides." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate({ to: "/studio" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/studio` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto max-w-sm px-6 pt-16">
        <Link to="/" className="text-sm tracking-[0.3em] text-muted-foreground">ADI</Link>
        <h1 className="mt-8 text-5xl">{mode === "in" ? "Welcome back" : "Create your studio"}</h1>
        <p className="mt-2 text-muted-foreground">For museum teams building audioguides.</p>

        <div className="mt-8 space-y-3">
          <Button variant="outline" className="h-12 w-full rounded-xl" onClick={() => oauth("google")}>
            Continue with Google
          </Button>
          <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
            Continue with Lovable
          </button>
        </div>
        <div className="my-6 text-center text-xs uppercase tracking-widest text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
          <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
            {mode === "in" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        <button className="mt-6 w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
