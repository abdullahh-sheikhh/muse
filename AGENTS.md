<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Guide audio is generated server-side (translate + text-to-speech) one language per call in `src/lib/audio.functions.ts`, stored in the private `audio` bucket, and served to visitors via the redirecting signed-URL route `/api/public/audio/$id` — public buckets are blocked and iOS needs range-capable URLs.
- Muse is the visitor-facing PWA (routes `/`, `/museums`, `/museum/$slug`, `/museum/$slug_/artifact/$ref`); visitors use Supabase anonymous auth via `ensureVisitor()` in `src/lib/visitor.ts`, which also owns location storage, preferred language, visit_events logging, and the Cache API audio packs. The artwork route file uses the trailing-underscore form so it is NOT nested under the museum page (which has no `<Outlet />`).
- Visitor guide audio: `/api/public/artwork-guide` caches per (artwork, language) in `artwork_guides`, gathers facts via Keenable, writes narration with built-in AI and voices it with ElevenLabs (`src/lib/guide.server.ts`), MP3 in the private `audio` bucket returned as a signed URL; `/api/public/transcribe` and `/api/public/health` live alongside. Server routes replace Supabase Edge Functions because the stack runs server code in TanStack Start. Pack downloads get per-file signed URLs from `/api/public/pack-urls/$packId`.
- Resolve museum photography through the shared `museumPhoto` helper in all museum views; show source attribution for verified photos and suppress unverified demo images to avoid misidentifying unrelated places.
- Keep seeded museum identity corrections in `museum-directory-corrections` as the shared source for photo matching and identity tests; preserve seeded IDs when correcting records so related visitor data stays attached.
