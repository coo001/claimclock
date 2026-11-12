# ClaimClock

ClaimClock re-checks an old answer claim by claim and shows whether each claim still holds, with the evidence, its dates and when to look again. Tavily finds current evidence, and a local Bifrost gateway relays the Gemini calls. The public demo replays stored runs and needs no API key.

**Demo:** https://coo001.github.io/claimclock/ · **Repository:** https://github.com/coo001/claimclock · **Video:** [127 s, silent, captioned](https://github.com/coo001/claimclock/blob/main/video/ClaimClock_demo.mp4) · **Deck:** [`ClaimClock_pitch_v13.pptx`](ClaimClock_pitch_v13.pptx)

**At a glance**

- **Run it:** Node.js 22 or later, no dependencies to install and no keys: `npm test && npm start`, then open `http://127.0.0.1:5173`.
- **The public demo can:** replay four stored real runs and three fixed examples, move the evaluation date and re-check cycles, download the ICS file, show the stored run log, and use the browser-local batch queue with JSON export.
- **The public demo cannot:** analyze new text. It has no backend, makes no Tavily, Gemini or Bifrost calls, and shows a notice instead of a result for any paragraph that is not a stored one.
- **Live analysis is local only:** it needs your own `TAVILY_API_KEY`, a locally running Bifrost gateway with a Gemini provider key, and a Bifrost virtual key in `.env` (see [Live local mode](#live-local-mode-optional)).
- **Every number here is a small-sample measurement** with its sample and assumptions stated next to it; the "Refuted" labels are model verdicts, not verified ground truth (see the [official cross-check](#cross-check-against-official-sources-2026-11-12-done-by-hand-after-the-run)).

![The default Node.js sample on 2024-10-21 (Supported) and 2024-10-22 (Refuted)](docs/claimclock-demo.png)

*The default sample, "Node.js 20.x is currently in Active LTS.", as the evaluation date moves from 2024-10-21 to 2024-10-22. Both items are Internet Archive (Wayback) captures: the v20.9.0 announcement captured 2023-10-25 and the official release schedule captured 2024-07-15.*

## Quick start (no keys needed)

Requirements: Node.js 22 or later. From the repository root:

```sh
npm test
npm start
```

Open `http://127.0.0.1:5173` in a browser. Pick a sample, then move the evaluation-date slider and the per-type re-check cycles: the score, timeline, re-check dates and ICS file update immediately. The first, default sample is the recorded Node.js 20.x stale-answer run. Three more recorded live runs are selectable: a 2023-dated paragraph in which two claims were refuted live and given suggested fixes, Python 3.8 and 3.12 support claims, and a Deno 2.0 release claim. Selecting a recorded run or re-verifying its exact text only replays stored output and makes no external calls.

**Typing your own paragraph.** A paragraph is shown with a result only when it exactly matches (after whitespace normalization) the text of a stored example. Matching the recorded real run replays that run's stored output; matching a fixed example shows its human-labeled example data and says it is not AI output. Any other paragraph gets no result. On the static demo (GitHub Pages) there is no backend, so the page says that no live analysis is possible there, that the paragraph was not analyzed or sent anywhere, and that live analysis requires a local install and your own API keys. With the local server but no keys configured, the page reports that live mode is not configured.

**Evidence as of the evaluation date.** An evidence item is used for an evaluation date only when both its event/publication date (if it has one) and its collection date are on or before that date; it becomes available on the later of the two. If an item has no collection time, the collection time of the enclosing result is used. An item with no defensible availability date is excluded. As a result, sources collected in 2026 are hidden in 2024 views even when they describe 2023 or 2024 events. In the default sample the two Wayback items are available from their capture-based dates (2023-10-25 and 2024-10-22) and the Tavily item from 2026-11-10, so 2024-10-21 shows Supported, 2024-10-22 shows Refuted and 2026-11-10 shows Refuted with one independent source. A saved Gemini fix suggestion is shown only from its generation date onward; if that date is unknown, it is hidden with a short note.

**Evidence provenance.** Each evidence item carries a visible badge. Items from recorded or local live runs are `External search (Tavily)`. Items in the fixed examples and the manually added timeline items are `Human-added`: they can still decide the relation and the date, but they are not counted as independent sources and do not lower the source-count component C. On 2026-11-10 the default sample therefore shows 1 independent source (the Tavily result), not 3. The manually added official Node.js v20.9.0 announcement keeps its 2023-10-24 publication date; its collection date is the Wayback capture time, 2023-10-25 18:10:12 UTC, and the schedule item's is 2024-07-15 14:09:15 UTC. They show an `Archived source (Wayback)` badge. The Node.js schedule marks 2024-10-22 as the start of Maintenance LTS; the separate v20 EOL date is 2026-04-30. The page-update date is never used as the event date.

**Browser-local batch recheck queue.** The "Batch recheck queue" panel has explicit buttons to save the current result, load all fixed examples for a demo, recheck stored records, remove one record and clear the queue. Nothing is saved automatically. Records stay in this browser's `localStorage` (versioned key `claimclock.batchQueue.v1`, at most 20 records) and are never uploaded. Batch recheck only recomputes status and priority from the evidence saved with each record, using the current evaluation date and cycles; it fetches no new evidence and never edits saved answers or evidence. Rows are sorted by highest claim score (descending), then title and id, and show the title, highest score, claim count and status counts; **Open** loads a record into the single-answer view. Unreadable or full storage is reported on the page instead of failing. The pure logic is in `lib/queue.js`.

## Status notes

- The browser UI and the pitch deck (`ClaimClock_pitch_v13.pptx`) are in English. The default Node.js sample replays a real stored Bifrost run. Three further live runs (stale claims refuted with fixes, Python, Deno 2.0) are stored and replayable. A 19-answer real-answer corpus measurement and the pre-registered 15-claim Node.js evaluation are reported below with their limits.
- The Pages demo is built from `main` by the manual `pages.yml` workflow. Changes on `main` appear there only after that workflow is run again.
- Older decks (`ClaimClock_pitch_v7` through `v12`) are kept only as history; `v13` is current. It differs from `v12` only in the wording and official-source links for the live stale-claim run on slides 6 and 9.

## Wayback evidence in the default sample

The default sample shows the claim as true at first and false after Node.js 20 left Active LTS. This needs evidence that existed at the time, so two Internet Archive captures are added to the sample as human-added evidence. Their capture times are used as collection times; the date rules are unchanged.

| Evidence | Wayback capture (UTC) | Takes effect |
|---|---|---|
| Node.js v20.9.0 announcement: "The 20.x release line now moves into Active LTS" | 2023-10-25 18:10:12 (`https://web.archive.org/web/20231025181012/https://nodejs.org/en/blog/release/v20.9.0`) | 2023-10-25 (event 2023-10-24) |
| Official `schedule.json`: v20 `maintenance` is 2024-10-22 | 2024-07-15 14:09:15 (`https://web.archive.org/web/20240715140915/https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`) | 2024-10-22 (event date) |

Both URLs were found with the Wayback CDX API and their text was read back from the captures. The slider therefore shows Insufficient evidence on 2023-10-24, Supported from 2023-10-25 to 2024-10-21, and Refuted from 2024-10-22. Archived items are human-added: they decide the relation and date but are not counted as independent sources. The Tavily result (collected 2026-11-10) appears only from that date, so the independent-source count is 0 until then and 1 on 2026-11-10.

## Small real-answer corpus (19 Stack Overflow answers)

How often do real, dated answers go stale, and does ClaimClock put the stale ones first? This was measured on a small set on 2026-11-12. Files: `public/corpus-stale-v1.json` (answers, labels, source excerpts, exclusions), `public/corpus-stale-v1-run.json` (the reported run) and `public/corpus-stale-v1-run-prompt1.json` (the earlier run), produced by `scripts/corpus-judge.mjs`.

**How the set was built.** Six keyword queries ("latest LTS version", "current LTS", "end of life version", "latest stable version is", "currently supported versions", "still supported until") were sent to the public Stack Exchange API for Stack Overflow answers created in 2023–2024, sorted by votes. Of 153 distinct answers, a fixed regex kept 25 that name a product version next to a time-sensitive word. Each was read; 6 were excluded for reasons listed in the file and 19 were labeled against a primary-source excerpt stored with each row (release schedules, vendor roadmaps, official announcements).

**What was found in the set.** 12 of the 19 answers (63%) contain a statement that is no longer true for a reader on 2026-11-12: 9 state a current/latest/supported status that has since changed, and 3 use a relative time phrase ("about a month from now") that has expired. 7 still hold.

**What ClaimClock did (judge prompt 2, evaluation date 2026-11-12).**

| | Stale (12) | Still valid (7) |
|---|---|---|
| At least one claim Refuted | 8 | 0 |
| Every claim Supported | 1 | 6 |
| Other (insufficient evidence or no claim extracted) | 3 | 1 |

- Sorted by highest claim score, the 12 highest-ranked answers contain 10 of the 12 stale ones.
- If a reviewer skipped the 7 answers in which every claim was Supported, 7 of 19 reads (37%) would be saved and 1 of the 12 stale answers would be missed (an Azul support end year that changed from 2027 to 2029). This is a count of answers, not measured reviewer time; no person was timed.
- The pipeline took a median of 2.4 s per answer (maximum 8.5 s, 48 Gemini requests in total through the Bifrost virtual key) with the search step replaced as described below.

**Limits. Read these before quoting any number above.**

- The set is a keyword-selected convenience set, deliberately enriched for version and support wording. 63% describes these 19 answers only; it is not an estimate for Stack Overflow or for answers in general.
- Labels were assigned during development with an AI coding assistant by comparing each quoted sentence with the stored primary-source excerpt. There was no second, independent human annotator.
- Retrieval was not tested. To stay inside the Tavily free quota, the search step was answered from the stored primary-source excerpt (0 Tavily requests), so the result measures extraction, judgment and ranking given good evidence. The 15-claim evaluation below shows that live retrieval does miss official sources.
- The judge prompt was changed after the first run on this same set. With prompt 1, 2 of the 12 stale answers were flagged, and 5 of the 19 runs hit provider 429 errors, so the two runs are not a clean comparison. Prompt 2 tells the judge the evaluation date and asks whether the claim is true on that date. Its result is therefore tuned on these 19 answers and is not a held-out result; no separate held-out set was run.
- One stale answer was flagged for a different sentence than the labeled one, and one stale answer produced no extracted claim.
- 19 answers are too few for a rate with a useful confidence interval.

## Public demo: feature checklist

What the static GitHub Pages demo is expected to do once the current `main` is deployed. The page shows whatever commit the manual `pages.yml` workflow last built, so check this list against the live page after each deployment; if an item is missing there, the deployment is older than this README.

Works on the public demo (no keys, no external calls):

1. The example drop-down lists the default recorded Node.js 20.x run, three more recorded live runs ("Three version-support claims dated 2023 (two refuted live)", Python 3.8/3.12, Deno 2.0) and the fixed examples; choosing one shows its claims, evidence, badges and scores.
2. **Recheck** on the exact text of a stored example replays the stored output and says that no external call was made.
3. The evaluation-date slider and the re-check cycles update status, score, timeline and re-check dates; the default sample is Supported on 2024-10-21 and Refuted on 2024-10-22.
4. **Download ICS** and "Show ICS contents" work.
5. The run log and "Real API run records" show the stored queries, URLs, requests and token usage.
6. The batch recheck queue: **Save current result**, **Load all fixed examples (demo)**, **Recheck stored records**, **Open**, remove, **Clear queue** and **Export queue JSON** (downloads `claimclock-queue.json`). The queue lives in this browser's `localStorage` only.

Does not work on the public demo (by design):

- Any paragraph that is not a stored one gets the notice "No live analysis is possible on this page." and no result; the text is not sent anywhere.
- No Tavily search, no Gemini or Bifrost call, no new evidence. Batch recheck only re-scores saved evidence.
- `npm run recheck` and the `live:run*` scripts are local command-line tools.

Local only: live analysis of new text, with the keys and the local Bifrost gateway described in [Live local mode](#live-local-mode-optional).

## Recorded real runs

### Live run that caught stale claims (2026-11-12, 3 claims)

A paragraph dated 2023-06-01 was typed into the local live UI and analyzed once, in real time, through Tavily and the local Bifrost virtual key; the same run is on the demo video. Three sentences were sent: "Node.js 20.x is currently in Active LTS." (the default example text, left in the input box by mistake, so there is no space after its period), "Python 3.8 is still receiving security updates." and "Node.js 18 is the newest LTS line." The run took 9.0 s with 3 Tavily searches and 4 Gemini requests. Both added claims were Refuted with a quote that passed the citation check, and each received a suggested fix; the first claim was Insufficient evidence because no quote passed the check. The unedited record is `public/live-run-stale-bifrost.json` and is a selectable, replayable example.

Limits: this is one run with three claims. Both refuting sources are third-party pages (a discuss.python.org thread and a personal blog), not the official schedules; the cross-check below compares them with the official sources. The suggested Python fix repeats the forum's wording ("will stop getting security updates in November 2024"), which is in the future tense and less precise than the official end-of-life date (2024-10-07), so it needs the human review the UI asks for. The run used judge prompt 1, before the prompt change described in the corpus section. It added 3 Tavily calls, for a known cumulative total of 43/50.

#### Cross-check against official sources (2026-11-12, done by hand after the run)

> **The "Refuted" labels in this run are model verdicts based on third-party pages. They are not verified ground truth.** The official sources below were read by hand on 2026-11-12, after the run. They were not among the evidence the model cited, and the stored record and the replay in the demo are unchanged, so the demo still shows only the third-party quotes.

| Claim (answer dated 2023-06-01) | Model verdict and its source | Official source | Does the official source agree? |
|---|---|---|---|
| "Python 3.8 is still receiving security updates." | Refuted. Forum post on discuss.python.org: "Python 3.8 will stop getting security updates in November 2024." | [PEP 569](https://peps.python.org/pep-0569/): security-only releases were provided "until October 7th 2024", and "As of 2024-10-07, 3.8 has reached the end-of-life phase of its release cycle"; the final security release was 3.8.20 on 2024-09-06. The [Python versions table](https://devguide.python.org/versions/) lists 3.8 as end-of-life, 2024-10-07. | **Verdict: yes.** Python 3.8 no longer receives security updates. **Quote and fix: no.** The official date is 2024-10-07, not "November 2024", and the suggested fix is in the future tense about a past event. |
| "Node.js 18 is the newest LTS line." | Refuted. Personal blog (hidekazu-konishi.com): "As of 2026-07-24 the supported LTS lines are Node.js 24 (Active LTS) and Node.js 22 (Maintenance LTS)". | Official [`schedule.json`](https://github.com/nodejs/Release/blob/main/schedule.json): v18 `end` 2025-04-30; v20 `lts` 2023-10-24; v24 `lts` 2025-10-28, `maintenance` 2026-10-20; v26 `lts` 2026-10-28. The [Node.js releases page](https://nodejs.org/en/about/previous-releases) lists v18 as EOL and v22, v24 and v26 as LTS. | **Verdict: yes.** Node.js 18 reached end of life on 2025-04-30 and newer LTS lines exist. **Fix: out of date.** The quote was right for 2026-07-24, but on the run date Node.js 26 had already entered LTS (2026-10-28) and Node.js 24 had moved to Maintenance (2026-10-20). The suggested fix omits Node.js 26. |
| "Node.js 20.x is currently in Active LTS." | Insufficient evidence (no quote passed the citation check). | Same `schedule.json`: v20 `maintenance` 2024-10-22, `end` 2026-04-30. | **No.** Against the official schedule this claim is false on 2026-11-12, so the run missed it. |

What this does and does not show:

- Both refuted claims were true when the answer was dated: on 2023-06-01 Python 3.8 was in its security-fix phase and Node.js 18 was the newest LTS line (Node.js 20 entered LTS on 2023-10-24). "Refuted" here means "no longer true on the evaluation date", not "wrong when written".
- In this one run the model's two Refuted verdicts match the official schedules, but neither suggested fix is accurate enough to paste, and one stale claim out of three was not caught. Live retrieval returned no official schedule for any of the three claims.
- Three claims are not an accuracy measurement.

### Second live example: Python support claims (N=2)

On 2026-11-11, a non-Node.js paragraph was analyzed through local Bifrost v2.5.0: “Python 3.8 reached end of life on October 7, 2024. Python 3.12 is supported through October 2028.” Gemini extracted two claims, Tavily was called twice, and Gemini made four Bifrost request attempts across extraction and judgment; both claims were labeled “supported,” with one cited Tavily result each. The saved replay is `public/live-run-python-bifrost.json` and is available as a selectable example. This is a two-claim demonstration, not an accuracy benchmark. The quoted 2028 date is treated as a target date, not a publication/event date; the Python 3.12 evidence date remains unknown and becomes available from its 2026-11-11 collection date. For this run only, Bifrost used `client.allow_direct_keys:true`, `x-bf-direct-key:true`, and the caller's Gemini key in the Authorization header; the key itself was not recorded. This added two Tavily calls, bringing the known cumulative total to 40/50. The public replay makes no API calls.

### Operating-path evaluation (pre-registered, Node.js N=15, judge prompt 1)

The final, pre-registered set contains eight status-shift claims and seven stable codenames. All 15 judgments completed; 12/15 exactly matched the frozen human labels (80%), including 5/8 status shifts and 7/7 codenames. All 15 Gemini-generated Tavily queries were sent unchanged. Prompts and rules were not changed during this evaluation; transient 429/503 responses and retries remain in the run records. It was run on 2026-11-10 with judge prompt 1 and has not been repeated with prompt 2 (introduced 2026-11-12), so 80% does not describe the current prompt. The evaluation used 18 new Tavily calls, bringing the known cumulative total to 38/50. Bifrost recorded 49 request attempts, 37 successful responses and 25,161 reported tokens. At the end of the run, the daily policy counter was 38/100 requests and 25,169/50,000 tokens (including an 8-token smoke check); the guard meter showed $0.0147018/$0.10. This is a small, Node.js-specific evaluation, not a general accuracy claim. Records: `public/live-evaluation-nodejs-v1-preregistered.json`, `public/live-evaluation-nodejs-v1.json` and `public/live-evaluation-nodejs-v1-retries.json`.

### Earlier direct-call evaluation (N=6)

On 2026-11-10, one earlier failing sample and five new samples (collected before any prompt change) were evaluated, giving six real API samples (`public/live-evaluation-pre.json`). Overall agreement was 5/6 (83.3%); the five new samples agreed 5/5. Every new sample has the human label "supported", so this is a small, single-class evaluation and is not evidence of general performance. Tavily searches: 6 for this evaluation set (1 for the earlier baseline sample + 5 new), plus 6 retries during earlier model exploration, for a cumulative 11. Prompts and rules were not changed.

Why the earlier sample scored 0/1: the official Node.js v20.9.0 announcement states "will remain so until October 2024", so the correct label is "supported". However, the Tavily results at the time were unofficial pages focused on EOL schedules that did not directly support that period, so Gemini judged the evidence insufficient. This mismatch is consistent with a retrieval problem: the official source was not among the search results for that sample. The sample was not re-evaluated after any fix.

### Earlier Bifrost demonstration (input-claim query, N=6)

On 2026-11-10, six new samples were evaluated through a local Bifrost v2.5.0 gateway using the existing `runLive` extraction and judgment path (`public/live-evaluation-bifrost-freequery-v1.json`). There are two samples per class (supported, refuted, insufficient evidence). Agreement with the human labels was 6/6 (N=6), and 2/2 for each class. The human labels were fixed before the run by checking the official source URLs directly. This run made 6 new Tavily calls, for a known cumulative total of 17 of 50. In this evaluation the transport layer sent the input claim sentence itself to Tavily; the query candidates Gemini generated are preserved separately in `results[].run.runLog.tavily[].generatedQuery`. The queries actually sent are in `results[].run.runLog.tavily[].query` and `results[].executedQueries`. The actual queries contain no `site:` filter, answer URL or domain restriction. Existing prompts and rules were not changed, and this record is separate from `live-evaluation-pre.json`. This is a small demonstration evaluation that **searched with the input claim as the query**; it does not evaluate the query quality of the operating path, where Tavily runs the Gemini-generated query. Six samples are not evidence of general performance.

Requests were authenticated with the virtual-key header (`x-bf-vk`), and `client.allow_direct_keys:false` meant the direct-key bypass was off. All 14 Gemini inference requests from the six runs succeeded, and all 14 were confirmed in Bifrost's built-in log API (`GET /api/logs`, HTTP 200) (`public/bifrost-runtime-feature.json`). One authentication smoke request (HTTP 200) is in the same log (`public/live-run-bifrost.json`). Valkey and the semantic cache were not used. When a source has no publication date, `published_date` and the evidence date stay null and are shown as "date unknown"; the page-update date is never used to guess the event date. The virtual-key value is absent from the recorded evaluation files and is not included in the repository.

The virtual-key setup probe before the evaluation (`public/bifrost-vk-link-probe.json`) is excluded from scoring. The Gemini provider key ID configured on the first virtual key was not linked, so Bifrost rejected every request with HTTP 400 (`no keys found for provider: gemini and model: gemini-3.5-flash-lite`). This probe made 0 Tavily calls and 0 Gemini provider calls and is not an evaluation sample. The evaluation above was then run with a new temporary virtual key that had the provider key ID linked.

### Direct-call records (not through Bifrost, earlier)

`public/live-run.json` records a direct Tavily + Gemini call, and `public/live-run-gemini-direct.json` records one direct Gemini call (HTTP 200). The `live-evaluation-pre.json` evaluation above also used the direct path. These records use a different execution path from the Bifrost records.

`npm run live:run` sends the fixed Node.js sample directly to the Tavily Search API and the Gemini API. It does not go through Bifrost, and it uses `TAVILY_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL` (default `gemini-3.5-flash-lite`) from `.env`. The script that collected the five new samples is `node --env-file=.env scripts/live-eval-pre.mjs`; it makes exactly one Tavily call and one Gemini call per sample, with no retries. Keys are never written into the recorded JSON.

## Live local mode (optional)

The static demo page only shows stored examples and recorded runs, and keys are never sent to the browser. Running the real API scripts is separate and may fail depending on available models and account limits. If a cost or paid plan is required, check the provider's official page before going ahead.

1. To create direct-call records, copy `.env.example` to `.env` and set `TAVILY_API_KEY` and `GEMINI_API_KEY`. `.env` is not committed to git.
2. To use Bifrost, follow the official install guide and run it locally: https://docs.getbifrost.ai/quickstart/gateway/setting-up
3. Configure the Gemini provider in the Bifrost admin UI: https://docs.getbifrost.ai/providers/supported-providers/gemini. Local live mode uses `TAVILY_API_KEY`, `BIFROST_BASE_URL=http://localhost:8080`, `BIFROST_VIRTUAL_KEY`, and `GEMINI_MODEL` from ignored `.env`; the virtual key is sent only from the local server as `x-bf-vk`.
4. `npm run live:run` is the direct path, `npm run live:run:bifrost` is the earlier gateway path, and `npm run live:run:deno` records a fresh one-claim example through the local virtual-key gateway. Keep the Tavily free-tier call limit in mind. Records are written to public-only files; never put key values in logs or the repository.
5. Semantic-cache performance was not measured: no Valkey/Redis runtime was reachable at `127.0.0.1:6379`. Local Bifrost configuration, databases and key files are not included in this repository. If you test caching separately, verify an actual cache hit before claiming savings.

Bifrost is an open-source gateway you can run yourself. That does not make the Gemini or Tavily inference APIs free. The app caps each input at 5 Gemini calls and 8 Tavily calls, and at 20 analyses per UTC day. 429/quota errors are not retried. Check prices and limits on each provider's official page before running.

## Sample data and limits

- Node.js 20.9.0 official release announcement and the Node.js releases table. The announcement states the codename Iron and the Active LTS period, and its publication date is 2023-10-24. The releases table's `Last updated` 2026-03-24 is a page-update date, not the EOL event date, so its evidence date is null. All evidence in this fixed example was collected on 2026-11-09 (the default recorded sample was collected on 2026-11-10, apart from its two Wayback items), so none of it appears in evaluations before that date, and the collection date is not treated as the date the fact occurred. All of it is human-added. Sources: https://nodejs.org/en/blog/release/v20.9.0 and https://nodejs.org/en/about/previous-releases
- A sample based on public Python 3.12 documentation (the answer text is a synthetic sentence written for the demo): https://docs.python.org/3/whatsnew/3.12.html
- ExampleCloud is a fully synthetic service and has no sources.

The default first sample is a `recorded-live` replay of the real Bifrost stale-claim run. It is not a new real-time Tavily/Gemini result. The other Node.js, Python and ExampleCloud samples are fixed examples. The UI shows the data type, authored date, evidence date, and collection date/method separately. If a source has no publication or event date, the date stays null and is shown as "date unknown". Collection time only limits when evidence can first be observed; it never replaces the event date. Past evaluations exclude evidence that was not yet published or not yet collected, and the date score uses only dates for evidence supporting the judged relation. Only external-search evidence counts toward independent sources. Date and relation judgments can be wrong; the score is a review priority, not a probability of truth. The public demo has no live arbitrary-input submission.

## Score definition

`R + A + C + U` (max 100): relation risk R (refuted 30, supported 0, insufficient evidence 15), age A, lack of independent sources C (external-search hosts only; human-added evidence is not counted), unknown date U (10). For insufficient evidence, A is 20. Worked examples: recent supporting evidence at 1 day on a 30-day cycle with 2 sources = 1.3; date-confirmed refutation with 2 sources = 70; insufficient evidence, unknown date, 0 sources = 65; unknown-date refutation with 1 source = 70. Relation and date are separate labels.

## Static hosting

`npm run build` copies the static files and `lib/` (including the browser-only queue helper `lib/queue.js`) into `dist/`. The GitHub Pages workflow is set up to run only on `workflow_dispatch`. The static demo ships stored, key-free run and evaluation records, including the default Node.js replay; no API keys, local Bifrost configuration or backend are included in the repository.

All page assets, module imports and data fetches use relative paths (`./…`), so the page works under the `/claimclock/` sub-path on GitHub Pages. `tests/basepath.test.js` checks this statically.

Destinations:

- Repository: https://github.com/coo001/claimclock
- Demo: https://coo001.github.io/claimclock/ (built from `main` by the manual Pages workflow; run it again after new commits)

## Batch recheck and measured unit economics

Press **Export queue JSON** in the queue panel (it downloads `claimclock-queue.json`) and run `npm run recheck -- path/to/queue.json [YYYY-MM-DD]`. This CLI re-scores saved evidence only; it makes **no** new Tavily, Bifrost, or Gemini calls. The browser queue remains local to the browser unless the user explicitly exports it.

Measured on the existing 15-claim Node.js evaluation record: 25,161 reported Gemini tokens across 49 Bifrost request attempts (37 successful), 18 Tavily search attempts, and $0.0147018 reported by the configured Bifrost budget meter. Normalized per evaluated claim: about 1,677 tokens, $0.00098 measured model cost, 3.27 Bifrost request attempts (including retries), and 1.2 Tavily searches. These are historical ratios from a small, Node.js-only sample, not a guarantee or a benchmark.

Illustrative monthly workload: 1,000 saved answers × 3 claims each × one recheck/month = 3,000 claim checks/month. If the observed per-claim mix held, estimate about 5.03 million tokens, $2.94 Bifrost-metered model cost, 9,800 gateway attempts, and 3,600 Tavily basic-search attempts (about 3,600 credits if each remains one credit). Assumptions: same model, prompts, retry rate, evidence search depth, and account pricing; excludes infrastructure, caching, rate limits, failed jobs beyond the measured sample, and price changes. A batch export/re-score does not itself fetch fresh evidence; each new evidence check still needs the local live analysis path.

## Verification

Run `npm test`, `npm run build`, `npm run check` and `npm run check:secrets`; what each one checks is listed below. `ClaimClock_pitch_v13.pptx` has eleven English slides; it adds the 19-answer corpus measurement with its limits and the live stale-claim run. The video link is on slide 10.

`npm run build` copies `public/` and `lib/` into `dist/`. The local server also serves `/live-run.json` statically.

- `npm test`: checks fixed scoring cases, label input, fixture matching, and how the ICS changes with date and cycle changes. It also checks that undated evidence is not back-dated to a page-update date, that evidence becomes available only on the later of its event and collection dates (with the result timestamp as fallback and exclusion when neither is known), that saved fix suggestions are hidden before their generation date or when it is unknown, that evidence provenance is assigned and preserved, that human-added evidence is not counted as an independent source, and that only dates of the judged relation feed the score. `tests/queue.test.js` checks the batch queue's sorting, 20-record cap, storage error handling, and that queue operations make no fetch calls and do not mutate saved records. In a key-free environment it starts the server on port 0 and checks `/`, the static JS/CSS/fixture modules, `/api/status` (`liveReady:false`), `/api/verify` (503 `LIVE_NOT_CONFIGURED`) and the recorded JSON responses for `/live-run.json`, `/live-evaluation-pre.json`, `/live-run-bifrost.json`, `/live-run-stale-bifrost.json`, `/live-run-gemini-direct.json`, `/live-evaluation-bifrost-freequery-v1.json`, `/bifrost-runtime-feature.json` and `/bifrost-vk-link-probe.json`. It checks that the first sample matches the Bifrost evaluation record exactly, that `recorded-live` mode is kept, that only the same paragraph is replayed, and that the replay notice says no external call was made; an exact-match fixed example is described as human-labeled data, not AI output. `tests/basepath.test.js` also checks that, without a backend, the page states that no live analysis is possible there and that live mode needs a local install and your own API keys. The live pipeline is only exercised with a mock fetch, so real API calls are 0. Tests make no external network calls.
- `npm run check`: syntax-checks every JS file with `node --check`.
- `npm run check:secrets`: checks that no real `.env` file other than `.env.example` exists, and that files git would commit (tracked files and new, non-ignored files) contain no strings shaped like API keys or tokens. Output shows only file paths and pattern names, never values or file contents. It judges by shape only, so false positives are possible: for example, a sample key in the docs (a long string starting with `sk-` or `AIza`) or a placeholder of 8+ characters in `.env.example` will fail. In that case, empty the value or use a placeholder shorter than 8 characters (for example `xxx`).

There are no browser end-to-end tests. [**Demo video**](https://github.com/coo001/claimclock/blob/main/video/ClaimClock_demo.mp4) (127s, 1080p, silent with burned-in captions; `video/ClaimClock_demo.srt` has the same text). The first 56 s are the unedited screen recording of the 2026-11-12 local live run in which two stale claims were refuted (captions were re-set afterwards); the rest shows the current UI in public replay mode with no API calls, and ends with the corpus numbers and their limits. The small operating-path evaluation and its limits are reported above; it is not a general benchmark.

## Current limitations (2026-11-12)

The following constraints remain; they are not presented as completed work.

- The N=15 operating-path evaluation is small and specific to Node.js release-status and codename claims; three of eight status shifts were mislabeled. It used judge prompt 1 and was not repeated after the prompt change. It is not a general performance benchmark.
- The 19-answer corpus is keyword-selected, labeled without an independent annotator, run without live retrieval, and its reported run uses a prompt adjusted on the same answers. It shows that stale version claims are easy to find in real answers and that ranking put most of them first; it does not establish a general stale rate, accuracy or time saved.
- Suggested fixes copy the cited evidence, including third-party wording, and must be reviewed by a person. Nothing is rewritten or sent automatically.
- Semantic-cache hit rate and savings were not measured because no Valkey/Redis runtime was reachable at `127.0.0.1:6379`.
- The static demo replays stored records. Live inference requires local credentials and a local gateway; no keys, Bifrost data/configuration, or gateway binary are included in the repository. The Pages demo shows the commit that was last deployed; newer commits on `main` appear only after the Pages workflow is run again.
- The batch queue only rescores evidence already saved with each record. It does not find new evidence, so a stored record cannot become fresher than its saved evidence.

## Technology and AI use

A plain Node.js HTTP server and browser JavaScript. The live AI feature passes Gemini calls through a local Bifrost gateway and uses Tavily for search. AI coding agents assisted development, including collecting and labeling the 19-answer corpus. Bifrost itself is Apache-2.0 open source; each dependency's license and API terms must be followed separately. The recorded real runs include earlier direct calls, an earlier six-sample Bifrost demonstration, and the separate 15-case operating-path evaluation above. The latter used a Bifrost virtual key with Gemini-generated queries sent unchanged to Tavily; its result, retries and usage counters are recorded in the linked JSON files.
