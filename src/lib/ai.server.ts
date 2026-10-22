import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev";
const TEXT_MODEL = "openai/gpt-6-astra";
const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const TTS_VOICE = "Kore";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

/** Translate a guide stop. Returns { title, body }. */
export async function translateStop(
  apiKey: string,
  input: { title: string; body: string },
  from: string,
  to: string,
) {
  const provider = createOpenAI({
    baseURL: `${GATEWAY}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(TEXT_MODEL),
    instructions:
      "You translate museum audioguide scripts. Keep the warm, spoken tone and all facts. Output ONLY: the translated title on the first line, then a line containing exactly ---, then the translated script. No commentary.",
    prompt: `Translate from ${from} to ${to}.\n\n${input.title}\n---\n${input.body}`,
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
  if (!text) throw new Error(failure instanceof Error ? failure.message : "Translation failed");
  const [title, ...rest] = text.split(/\n\s*---\s*\n/);
  return { title: (title ?? input.title).trim(), body: rest.join("\n").trim() || input.body };
}

/** Write a spoken guide script for one artwork, in the requested language. */
export async function writeGuideScript(
  apiKey: string,
  input: {
    title: string;
    artist: string;
    year: string;
    room: string;
    museumName: string;
    facts: string[];
  },
  language: string,
) {
  const provider = createOpenAI({
    baseURL: `${GATEWAY}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(TEXT_MODEL),
    instructions:
      "You are a warm, calm museum guide recording an audio guide. Write a spoken script of about 120 words: vivid, accurate, no headings, no lists, no stage directions — only the words the visitor will hear. Use the curator facts when provided; never invent provenance or dates.",
    prompt: `Write the script in ${language}.\n\nMuseum: ${input.museumName}\nArtwork: ${input.title}\nArtist: ${input.artist}\nYear: ${input.year}\nRoom: ${input.room}\nCurator facts:\n${input.facts.map((f) => `- ${f}`).join("\n") || "(none)"}`,
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
  if (!text) throw new Error(failure instanceof Error ? failure.message : "Script generation failed");
  return text;
}

/** Generate a narrated WAV file for the given script. */
export async function synthesize(apiKey: string, text: string) {
  const res = await fetch(`${GATEWAY}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: `Read this like a warm, calm museum guide:\n\n${text}` }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
      stream_format: "audio",
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    const err = new Error(
      res.status === 402
        ? "AI credits are exhausted. Add credits to keep generating audio."
        : res.status === 429
          ? "Too many requests, please wait a moment and retry."
          : `Voice generation failed (${res.status}) ${msg.slice(0, 200)}`,
    );
    throw err;
  }
  return new Uint8Array(await res.arrayBuffer());
}
