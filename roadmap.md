# Muse — build roadmap

- [x] Schema: extend museums (city, lat/lng, image, is_partner, ref_label); add profiles, artifacts, audio_packs, artwork_facts, visit_events; RPCs nearby_museums + lookup_artifact; seed demo museums
- [x] Enable anonymous sign-in
- [x] PWA manifest + icons
- [x] Dark gallery theme
- [x] Route /: welcome, geolocation + city search
- [x] Route /museums: nearby_museums cards, Pro guide badge
- [x] Route /museum/$slug: header, pack download + language picker, QR scan, ref lookup, artwork list
- [x] Route /museum/$slug/artifact/$ref: artwork page, audio player, transcript, sources, Ask-the-guide placeholder
- [x] Server route /api/public/artwork-guide (script + TTS audio)
- [x] Server route for pack download signed URLs
- [x] visit_events logging (number_entry, qr_scan, open, play)
- [x] Verify: build, tests, browser smoke test
- [x] Museum cover photos: demo images hosted as app assets, shown in the picker list and museum header
