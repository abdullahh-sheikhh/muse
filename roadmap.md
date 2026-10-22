# Muse — build roadmap

- [ ] Schema: extend museums (city, lat/lng, image, is_partner, ref_label); add profiles, artifacts, audio_packs, artwork_facts, visit_events; RPCs nearby_museums + lookup_artifact; seed demo museums
- [ ] Enable anonymous sign-in
- [ ] PWA manifest + icons
- [ ] Dark gallery theme
- [ ] Route /: welcome, geolocation + city search
- [ ] Route /museums: nearby_museums cards, Pro guide badge
- [ ] Route /museum/$slug: header, pack download + language picker, QR scan, ref lookup, artwork list
- [ ] Route /museum/$slug/artifact/$ref: artwork page, audio player, transcript, sources, Ask-the-guide placeholder
- [ ] Server route /api/public/artwork-guide (script + TTS audio)
- [ ] Server route for pack download signed URLs
- [ ] visit_events logging (number_entry, qr_scan, open, play)
- [ ] Verify: build, tests, browser smoke test
