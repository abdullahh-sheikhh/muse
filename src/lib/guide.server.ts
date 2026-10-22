// Server-only helpers for the visitor audio guide: Keenable fact search,
// narration writing (built-in AI), ElevenLabs speech and transcription.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev";
const TEXT_MODEL = "openai/gpt-6-astra";
const ELEVEN = "https://api.elevenlabs.io";
// Used when ELEVENLABS_VOICE_ID is not set ("Sarah", multilingual stock voice).
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export type SearchHit = { title: string; url: string; snippet: string };

const BLOCKED = ["boutique", "shop", "store"];

export async function keenableSearch(apiKey: string, query: string, maxResults: number) {
  const res = await fetch("https://api.keenable.ai/v1/search", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: maxResults }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Keenable ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    results?: { title?: string; url?: string; description?: string; snippet?: string }[];
  };
  return (json.results ?? [])
    .filter((r) => r.url && !BLOCKED.some((b) => r.url!.toLowerCase().includes(b)))
    .map((r) => ({
      title: r.title ?? r.url!,
      url: r.url!,
      snippet: (r.snippet || r.description || "").trim(),
    }))
    .filter((r) => r.snippet) as SearchHit[];
}

function provider(apiKey: string) {
  return createOpenAI({
    baseURL: `${GATEWAY}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

async function runText(apiKey: string, instructions: string, prompt: string) {
  let failure: unknown;
  const result = streamText({
    model: provider(apiKey).responses(TEXT_MODEL),
    instructions,
    prompt,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onError: ({ error }) => {
      failure = error;
    },
  });
  const text = (await result.text).trim();
  if (!text) throw new Error(failure instanceof Error ? failure.message : "AI returned no text");
  return text;
}

export async function agentGreeting(apiKey: string, title: string, language: string) {
  const english = `Hi! You're looking at ${title}. What would you like to know?`;
  if (language.split("-")[0] === "en") return english;
  try {
    return await runText(apiKey, `Translate the greeting into ${languageName(language)}. Keep the artwork title. Return only the greeting, no markdown.`, english);
  } catch {
    return english;
  }
}

export async function elevenAgent(apiKey: string, agentId: string) {
  const res = await fetch(`${ELEVEN}/v1/convai/agents/${encodeURIComponent(agentId)}`, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`ElevenLabs agent ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export function writeNarration(
  apiKey: string,
  art: { title: string; artist: string; year: string },
  facts: string[],
  languageName: string,
) {
  return runText(
    apiKey,
    `You are a warm museum guide. Write a 120–160 word spoken narration for a visitor standing in front of this artwork. Use ONLY the facts given; never invent names or dates. Plain prose, no markdown. Write it entirely in ${languageName}.`,
    `Artwork: ${art.title}\nArtist: ${art.artist || "unknown"}\nYear: ${art.year || "unknown"}\n\nFacts:\n${facts.map((f) => `- ${f}`).join("\n") || "(no facts available)"}`,
  );
}

export function sayOk(apiKey: string) {
  return runText(apiKey, "Reply with exactly: ok", "say ok");
}

export async function elevenTts(apiKey: string, voiceId: string, text: string) {
  const res = await fetch(
    `${ELEVEN}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS ${res.status}: ${body.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function elevenStt(apiKey: string, file: Blob, filename: string) {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model_id", "scribe_v1");
  const res = await fetch(`${ELEVEN}/v1/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string; language_code?: string };
  return { text: (json.text ?? "").trim(), language_code: json.language_code ?? "" };
}

export async function elevenUser(apiKey: string) {
  const res = await fetch(`${ELEVEN}/v1/user`, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

export function languageName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
