import { createFileRoute } from "@tanstack/react-router";

// Public: guide audio is meant for any visitor. Redirects to a short-lived signed file URL
// (signed URLs support range requests, which iOS needs for playback).
export const Route = createFileRoute("/api/public/audio/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("stop_audio")
          .select("audio_url")
          .eq("id", params.id)
          .maybeSingle();
        if (!row) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage
          .from("audio")
          .createSignedUrl(row.audio_url, 60 * 60 * 6);
        if (error || !data) return new Response("Unavailable", { status: 500 });
        return new Response(null, {
          status: 302,
          headers: { Location: data.signedUrl, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
