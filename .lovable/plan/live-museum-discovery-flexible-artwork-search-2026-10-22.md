# Live museum discovery + flexible artwork search

## What changes

### 1. Search-and-save museum discovery (no hardcoded museums)
- New public server route `POST /api/public/discover-museum` taking `{ query }` (a museum name, or "museums in <city>").
- Flow: check the `museums` table first (by slug/name+city) → if missing, search Keenable → built-in AI structures the results into `{ name, city, country, lat, lng, intro, image_url }` → insert into `museums` (fixed system owner id) → return the museum.
- The home screen keeps the Country → City → Museum tabs, but gains a search box: "Can't find it? Search any museum or city". A search that finds something new saves it, so the next visitor sees it in the tabs instantly. Repeated searches never call Keenable again.
- Photos: only used when the source page is clearly the museum itself (per the real-photography rule); otherwise left empty.

### 2. Flexible artwork search inside a museum
- The museum page gets one search box that matches anything: ref number, title, artist, room, or keyword in the description (`ilike` across columns).
- Exact ref match still jumps straight to the artwork (and logs `number_entry`); otherwise a list of matching artworks appears and filters as you type. "Number not found. Check the label." stays for exact-ref misses.

### 3. Artwork import, stored once
- New public server route `POST /api/public/import-artworks` taking `{ museum_id }`.
- Flow: if the museum already has artifacts, return them (no Keenable call) → otherwise Keenable search for the museum's notable artworks → AI structures title/artist/year/room/description → insert into `artifacts` (skip refs that already exist).
- The museum page shows a "Load artworks" button when a museum has none; after import they behave like any other artworks (guides, audio, QR).

### 4. Caching
- Server-side cache = the database itself: museums, artifacts, artwork_facts, artwork_guides, and audio files in the storage bucket are each created once and reused; every route checks the DB before calling Keenable/ElevenLabs.
- Client-side: museum directory and artwork lists get React Query `staleTime` (5 min) so tabbing around doesn't refetch; audio stays in the Cache API pack system already built.

## Technical notes
- Both new routes live under `src/routes/api/public/` (server-side only; KEENABLE_API_KEY never reaches the browser) and use the publishable-key client for reads, `supabaseAdmin` for inserts.
- Keenable failures degrade gracefully: discovery returns "not found", import returns an empty list — never a bare 500.
- No schema migration needed: existing tables cover it (inserts go through the admin client).
- Verify with build + vitest + a browser run: search a new museum, open it, load artworks, search by keyword.
