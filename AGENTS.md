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
