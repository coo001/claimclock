# ClaimClock demo video script (target: under 2 minutes)

No video has been produced. This is a script only. Times are approximate; read at about 140 words per minute.

Recording rule: use the real application served locally (`npm start`, `http://127.0.0.1:5173`) and, for the evaluation summary, the actual `ClaimClock_pitch_v7.pptx` slide. Do not use mockups. Do not say a URL is live unless it has been checked on the day of recording.

---

**0:00–0:15 — Problem**

Screen: ClaimClock home page, sample selector at the top.

Voice: "AI answers age. A sentence that was true when it was written can quietly become wrong. ClaimClock re-checks an old answer claim by claim and tells you when to check it again."

**0:15–0:40 — Recorded sample**

Screen: default sample loaded; point at the data-type label and the run-log panel.

Voice: "The default sample is a stored record from a real run through a local Bifrost gateway to Gemini, with Tavily evidence. The page replays that record. It makes no new external calls, and it says so."

**0:40–1:05 — Time controls**

Screen: move the evaluation date to 2024-10-21, then 2024-10-22; briefly show the resulting status change.

Voice: "On October 21 the historical answer is still supported. One day later, the official schedule marks the start of Maintenance LTS, so the answer is refuted. The separate EOL date is April 30, 2026. A page-update date is never treated as the event date."

**1:05–1:25 — Score and calendar**

Screen: per-claim results, then the ICS preview and download button.

Voice: "The score is a review priority from 0 to 100, not a probability of truth. Each claim gets a re-check date you can export as a calendar file."

**1:25–1:45 — Evidence and honesty**

Screen: show the real recorded API runs, then the evaluation summary on slide 6 of `ClaimClock_pitch_v7.pptx`.

Voice: "The pre-registered operating-path evaluation covers 15 Node.js claims. Twelve labels matched exactly; five of eight status shifts and all seven stable codenames were correct. Queries were sent unchanged. This is a small, domain-specific evaluation, not a general benchmark."

**1:45–2:00 — Close**

Screen: README section on live local mode.

Voice: "Run it locally with your own keys for live analysis. Keys stay on the server. ClaimClock: know when your answers expire."

---

Before recording, check:

- The on-screen UI is English. Confirm the actual sample text and selected dates match the narration.
- The default sample is a real stored Bifrost stale-fact run; replaying it must make no new external calls. The 2024-10-21 and 2024-10-22 states are captured in the deck.
