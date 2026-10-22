import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAgentAccess, startAgentInput, visitedTitles } from "./agent-rules";

export const startAgentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => startAgentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: art, error } = await db.from("artifacts").select("*, museums(name, is_partner)").eq("id", data.artworkId).single();
    if (error || !art) throw new Error("Artwork not found");
    assertAgentAccess(art.museums?.is_partner === true, 0);
    const { count, error: countError } = await db.from("visit_events").select("id", { count: "exact", head: true }).eq("visitor_id", context.userId).eq("event_type", "agent_start").gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if (countError) throw new Error("Couldn't check session availability, try again");
    assertAgentAccess(true, count ?? 0);
    const [facts, guides, events, artworks] = await Promise.all([
      db.from("artwork_facts").select("label").eq("artwork_id", art.id).order("sort_order"),
      db.from("artwork_guides").select("language, script_text").eq("artwork_id", art.id).in("language", [data.language, "en"]),
      db.from("visit_events").select("artwork_id").eq("visitor_id", context.userId).eq("museum_id", art.museum_id).eq("event_type", "open").gte("created_at", new Date(Date.now() - 21600000).toISOString()).order("created_at", { ascending: false }),
      db.from("artifacts").select("id, title").eq("museum_id", art.museum_id),
    ]);
    if (facts.error || guides.error || events.error || artworks.error) throw new Error("Couldn't load artwork context, try again");
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const agentId = process.env["ELEVENLABS_AGENT_ID"];
    if (!apiKey || !agentId) throw new Error("The talking guide isn't configured yet");
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { headers: { "xi-api-key": apiKey } });
    if (!response.ok) {
      console.error("Agent session failed", response.status, await response.text());
      throw new Error("Couldn't connect, try again");
    }
    const json = await response.json() as { signed_url?: string };
    if (!json.signed_url) throw new Error("Couldn't connect, try again");
    const g = await import("./guide.server");
    const firstMessage = await g.agentGreeting(process.env["LOVABLE_API_KEY"] ?? "", art.title, data.language);
    const { error: logError } = await db.from("visit_events").insert({ visitor_id: context.userId, museum_id: art.museum_id, artwork_id: art.id, event_type: "agent_start" });
    if (logError) throw new Error("Couldn't start the guide, try again");
    return {
      signedUrl: json.signed_url,
      dynamicVariables: {
        museum_name: art.museums?.name ?? "", artwork_title: art.title, artwork_artist: art.artist,
        artwork_year: art.year, artwork_room: art.room,
        artwork_facts: (facts.data?.map((fact) => fact.label).join(" • ") || art.description).slice(0, 3000),
        narration: guides.data?.find((guide) => guide.language === data.language)?.script_text ?? guides.data?.find((guide) => guide.language === "en")?.script_text ?? "",
        visited: visitedTitles(events.data ?? [], artworks.data ?? [], art.id), language_name: g.languageName(data.language),
      },
      language: (data.language.split("-")[0] ?? "en").toLowerCase(), firstMessage,
    };
  });