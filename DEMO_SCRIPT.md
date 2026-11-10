# ClaimClock demo video script (target: under 2 minutes)

This is the narration script. Times are approximate; read at about 140 words per minute.

Recording rule: use the real application served locally (`npm start`, `http://127.0.0.1:5173`) and, for the evaluation summary, the actual `ClaimClock_pitch_v8.pptx` slide. Do not use mockups. Do not say a URL is live unless it has been checked on the day of recording.

---

**0:00–0:15 — Problem**

Screen: ClaimClock home page, sample selector at the top.

Voice: "AI answers age. A sentence that was true when it was written can quietly become wrong. ClaimClock re-checks an old answer claim by claim and tells you when to check it again."

**0:15–0:40 — Recorded sample**

Screen: default sample loaded; point at the data-type label and the run-log panel.

Voice: "The default sample is a stored record from a real run through a local Bifrost gateway to Gemini, with Tavily evidence. The page replays that record. It makes no new external calls, and it says so."

**0:40–1:05 — Time controls**

Screen: move the evaluation date back to 2024-10-22, then forward to 2026-11-10; point at the hidden-evidence note and the evidence provenance badges.

Voice: "Evidence only counts from the day it was actually collected. All of this evidence was collected in November 2026, so a 2024 view shows insufficient evidence instead of pretending we knew then. Today the answer is refuted: the official schedule moved Node.js 20 to Maintenance LTS on October 22, 2024, and its EOL was April 30, 2026. Only the Tavily result counts as an independent source; human-added items are labeled and not counted."

**1:05–1:25 — Score and calendar**

Screen: per-claim results, then the ICS preview and download button.

Voice: "The score is a review priority from 0 to 100, not a probability of truth. Each claim gets a re-check date you can export as a calendar file."

**1:25–1:45 — Evidence and honesty**

Screen: show the real recorded API runs, then the evaluation summary on slide 6 of `ClaimClock_pitch_v8.pptx`.

Voice: "The pre-registered operating-path evaluation covers 15 Node.js claims. Twelve labels matched exactly; five of eight status shifts and all seven stable codenames were correct. Queries were sent unchanged. This is a small, domain-specific evaluation, not a general benchmark."

**1:45–2:00 — Close**

Screen: README section on live local mode.

Voice: "Run it locally with your own keys for live analysis. Keys stay on the server. ClaimClock: know when your answers expire."

---

Before recording, check:

- The on-screen UI is English. Confirm the actual sample text and selected dates match the narration.
- The default sample is a real stored Bifrost stale-fact run; replaying it must make no new external calls. The v8 cover now shows 2024-10-22 as Insufficient evidence and 2026-11-10 as Refuted. Confirm the selected dates and current screen before recording.
