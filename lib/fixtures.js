// First entry: a recorded real Bifrost run (mode 'recorded-live', replay-only, see below).
// Other entries: fixed public/synthetic examples. Evidence quotes were checked manually against the live pages on
// 2026-11-09 (Claude Code WebFetch). They were NOT produced by Tavily or Gemini.
// Relation labels were assigned by a human reading the quoted excerpts.

const COLLECTED = '2026-11-09';
const MANUAL = 'Source excerpts were checked manually against the original pages; no Tavily or Gemini calls. A human assigned the relation labels.';
const FIXTURE_LOG = {
  note: 'Fixed example · no external API calls (0 Tavily, 0 Gemini, no Bifrost).',
  externalCalls: false,
  counts: { gemini: 0, tavily: 0 },
  tavily: [],
  gemini: [],
};

const NODE_RELEASES_URL = 'https://nodejs.org/en/about/previous-releases';
const NODE_BLOG_URL = 'https://nodejs.org/en/blog/release/v20.9.0';
const PY312_URL = 'https://docs.python.org/3/whatsnew/3.12.html';

// Verbatim copy of results[0].run from public/live-evaluation-bifrost-freequery-v1.json:
// an actual runLive execution through local Bifrost v2.5.0 (virtual key) on 2026-11-10.
// In this app it is replay-only: selecting or rechecking this exact text makes no external call.
const BIFROST_RECORDED_RUN = {
  "id": "live-1794294091230",
  "mode": "live",
  "title": "Your answer (local live analysis)",
  "authoredDate": "2023-10-24",
  "answerText": "Node.js 20.x is currently in Active LTS.",
  "source": {
    "status": "USER_INPUT",
    "url": null,
    "publishedDate": null,
    "publishedDateText": "",
    "note": "User input is not stored or logged by the server."
  },
  "collectedAt": "2026-11-10T07:01:31.230Z",
  "collectionMethod": "Tavily basic search + Gemini judgment through Bifrost",
  "claims": [
    {
      "id": "c1",
      "text": "Node.js 20.x is currently in Active LTS.",
      "type": "버전",
      "relation": "반박",
      "relationNote": "",
      "evidence": [
        {
          "id": "d47d36-02",
          "url": "https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of",
          "title": "Node.js Version Support: EOL Dates and Latest Releases (July 2026)",
          "quote": "| Node.js 20 | EOL (Apr 30, 2026) | Upgrade to 22/24, or adopt NES |",
          "stance": "반박",
          "citationOk": true,
          "date": "2026-04-30",
          "dateBasis": "Date appears verbatim in the cited source text.",
          "collectedAt": "2026-11-10T07:01:41.029Z"
        }
      ],
      "fix": "Node.js 20 has an End of Life date of April 30, 2026."
    }
  ],
  "runLog": {
    "note": "Local live run (app limits: 5 Gemini calls · 8 Tavily calls · sequential · no retry on 429)",
    "externalCalls": true,
    "counts": {
      "gemini": 4,
      "tavily": 1
    },
    "tavily": [
      {
        "query": "Node.js 20 release schedule LTS status",
        "topic": "general",
        "collectedAt": "2026-11-10T07:01:41.029Z",
        "results": [
          {
            "url": "https://hidekazu-konishi.com/entry/nodejs_release_and_eol_timeline.html",
            "title": "Node.js Release and EOL Timeline - LTS Schedule, Active LTS and Maintenance, and End-of-Life Dates | hidekazu-konishi.com",
            "published_date": null,
            "contentExcerpt": "| 2023-04-18 | Node.js 20 \"Iron\" is released (entering Active LTS on 2023-10-24). Node.js 20 became one of the most widely deployed LTS lines in the project's history. Source: Node.js v20.0.0 released. |\n| 2023-04-30 | Node.js 14 \"Fermium\" reaches End-of-Life. Source: Node.js Releases (nodejs.org). "
          },
          {
            "url": "https://gorbe.io/posts/nodejs/release-schedule",
            "title": "Node.js Release Schedule · G⌬RBE",
            "published_date": null,
            "contentExcerpt": "| 14.x | End-of-Life | Fermium | 2020-04-21 | 2020-10-27 | 2021-10-19 | 2023-04-30 |\n| 15.x | End-of-Life | 2020-10-20  2021-06-01 |\n| 16.x | End-of-Life | Gallium | 2021-04-20 | 2021-10-26 | 2022-10-18 | 2023-09-11 |\n| 17.x | End-of-Life | 2021-10-19  2022-06-01 |\n| 18.x | Maintenance | Hydrogen | "
          },
          {
            "url": "https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of",
            "title": "Node.js Version Support: EOL Dates and Latest Releases (July 2026)",
            "published_date": null,
            "contentExcerpt": "| Version Range | Status | Recommended Action |\n --- \n| Node.js 26 | Current | Fine for testing; move to LTS for production |\n| Node.js 24 | Active LTS | Supported; recommended upgrade target |\n| Node.js 22 | Maintenance LTS (EOL Apr 2027) | Supported; good upgrade target |\n| Node.js 21, 23, 25 (odd"
          }
        ]
      }
    ],
    "gemini": [
      {
        "step": "extract",
        "requestedModel": "gemini/gemini-3.5-flash-lite",
        "provider": "gemini",
        "responseModel": "gemini-3.5-flash-lite",
        "latencyMs": 7023,
        "usage": {
          "prompt_tokens": 105,
          "prompt_tokens_details": {
            "text_tokens": 105,
            "cached_tokens": 0,
            "cache_write_tokens": 0
          },
          "completion_tokens": 39,
          "total_tokens": 144
        },
        "input": {
          "model": "gemini/gemini-3.5-flash-lite",
          "messages": [
            {
              "role": "system",
              "content": "You extract checkable factual claims from an answer. Return JSON only: {\"claims\":[{\"text\":\"...\",\"type\":\"가격|버전|직책|통계|안정 사실\",\"query\":\"web search query\"}]}. At most 8 claims. Keep the claim language the same as the input. Prefer official/primary sources in the query."
            },
            {
              "role": "user",
              "content": "{\"authored_date\":\"2023-10-24\",\"answer\":\"Node.js 20.x is currently in Active LTS.\"}"
            }
          ]
        },
        "output": "{\"claims\":[{\"text\":\"Node.js 20.x is currently in Active LTS.\",\"type\":\"버전\",\"query\":\"Node.js 20 release schedule LTS status\"}]}"
      },
      {
        "step": "judge",
        "requestedModel": "gemini/gemini-3.5-flash-lite",
        "provider": "gemini",
        "responseModel": "gemini-3.5-flash-lite",
        "latencyMs": 1406,
        "usage": {
          "prompt_tokens": 1431,
          "prompt_tokens_details": {
            "text_tokens": 1431,
            "cached_tokens": 0,
            "cache_write_tokens": 0
          },
          "completion_tokens": 74,
          "total_tokens": 1505
        },
        "input": {
          "model": "gemini/gemini-3.5-flash-lite",
          "messages": [
            {
              "role": "system",
              "content": "For each claim, judge its relation to the evidence. Return JSON only: {\"judgements\":[{\"claim_id\":\"c1\",\"relation\":\"support|refute|insufficient\",\"citations\":[{\"evidence_id\":\"e1\",\"quote\":\"exact substring copied from the evidence content\"}]}]}. Use insufficient when evidence is unrelated or unclear. Quotes must be copied verbatim."
            },
            {
              "role": "user",
              "content": "{\"claims\":[{\"id\":\"c1\",\"text\":\"Node.js 20.x is currently in Active LTS.\"}],\"evidence\":[{\"id\":\"e44679-00\",\"claim_id\":\"c1\",\"url\":\"https://hidekazu-konishi.com/entry/nodejs_release_and_eol_timeline.html\",\"content\":\"| 2023-04-18 | Node.js 20 \\\"Iron\\\" is released (entering Active LTS on 2023-10-24). Node.js 20 became one of the most widely deployed LTS lines in the project's history. Source: Node.js v20.0.0 released. |\\n| 2023-04-30 | Node.js 14 \\\"Fermium\\\" reaches End-of-Life. Source: Node.js Releases (nodejs.org). | [...] Node.js 20 \\\"Iron\\\" reached End-of-Life on 2026-04-30. Node.js 18 \\\"Hydrogen\\\" reached End-of-Life on 2025-04-30, and Node.js 22 \\\"Jod\\\" is scheduled to reach End-of-Life on 2027-04-30. The exact EOL date for every major is listed in the per-version table above; the values come from the official Node.js Releases schedule.  \\n\\n### Why are odd-numbered Node.js versions not recommended for production? [...] | 2026-04-30 | Node.js 20 \\\"Iron\\\" reaches End-of-Life. Because Node.js 20 was so widely deployed, its EOL left a large installed base needing to move to Node.js 22 or 24. Source: Node.js Releases (nodejs.org). |\\n| 2026-05-05 | Node.js 26 is released as the new Current line (scheduled to enter Active LTS on 2026-10-28). Node.js 26 is the last major to follow the existing odd/even model. Source: Node.js v26.0.0 released. |\"},{\"id\":\"01f489-01\",\"claim_id\":\"c1\",\"url\":\"https://gorbe.io/posts/nodejs/release-schedule\",\"content\":\"| 14.x | End-of-Life | Fermium | 2020-04-21 | 2020-10-27 | 2021-10-19 | 2023-04-30 |\\n| 15.x | End-of-Life | 2020-10-20  2021-06-01 |\\n| 16.x | End-of-Life | Gallium | 2021-04-20 | 2021-10-26 | 2022-10-18 | 2023-09-11 |\\n| 17.x | End-of-Life | 2021-10-19  2022-06-01 |\\n| 18.x | Maintenance | Hydrogen | 2022-04-19 | 2022-10-25 | 2023-10-18 | 2025-04-30 |\\n| 19.x | End-of-Life | 2022-10-18  2023-06-01 |\\n| 20.x | LTS | Iron | 2023-04-18 | 2023-10-24 | 2024-10-22 | 2026-04-30 |\"},{\"id\":\"d47d36-02\",\"claim_id\":\"c1\",\"url\":\"https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of\",\"content\":\"| Version Range | Status | Recommended Action |\\n --- \\n| Node.js 26 | Current | Fine for testing; move to LTS for production |\\n| Node.js 24 | Active LTS | Supported; recommended upgrade target |\\n| Node.js 22 | Maintenance LTS (EOL Apr 2027) | Supported; good upgrade target |\\n| Node.js 21, 23, 25 (odd) | EOL | Move to an even-numbered LTS immediately |\\n| Node.js 20 | EOL (Apr 30, 2026) | Upgrade to 22/24, or adopt NES |\\n| Node.js 18 | EOL (Apr 30, 2025) | Upgrade to 22/24, or adopt NES | [...] Odd-numbered releases (19, 21, 23, 25) never enter LTS. They stay Current for six months and then go straight to EOL, which is why they are unsuitable for production. Even-numbered releases (18, 20, 22, 24, 26) get the full LTS treatment and roughly three years of total support from initial release to EOL. For any system you intend to run longer than a quarter, an even-numbered LTS line is the only sensible choice.\\n\\n‍\\n\\n## Complete Node.js Version Timeline [...] The only fully supported lines today are Node.js 26 (Current), 24 (Active LTS), and 22 (Maintenance LTS). Everything else is end-of-life.\\n\\n‍\\n\\n## Versions Reaching EOL Next: What to Watch\\n\\n### Node.js 20 End of Life\\n\\nNode.js 20 reached en\"}]}"
            }
          ]
        },
        "output": "{\"judgements\":[{\"claim_id\":\"c1\",\"relation\":\"refute\",\"citations\":[{\"evidence_id\":\"d47d36-02\",\"quote\":\"| Node.js 20 | EOL (Apr 30, 2026) | Upgrade to 22/24, or adopt NES |\"}]}]}",
        "citationCheck": [
          {
            "claim_id": "c1",
            "evidence_id": "d47d36-02",
            "quote": "| Node.js 20 | EOL (Apr 30, 2026) | Upgrade to 22/24, or adopt NES |",
            "passed": true
          }
        ]
      },
      {
        "step": "fix:c1",
        "requestedModel": "gemini/gemini-3.5-flash-lite",
        "provider": "gemini",
        "responseModel": "gemini-3.5-flash-lite",
        "latencyMs": 2533,
        "usage": {
          "prompt_tokens": 89,
          "prompt_tokens_details": {
            "text_tokens": 89,
            "cached_tokens": 0,
            "cache_write_tokens": 0
          },
          "completion_tokens": 28,
          "total_tokens": 117
        },
        "input": {
          "model": "gemini/gemini-3.5-flash-lite",
          "messages": [
            {
              "role": "system",
              "content": "Rewrite the refuted claim so it matches the cited evidence. Return JSON only: {\"fix\":\"...\"}. Do not add facts that are not in the evidence."
            },
            {
              "role": "user",
              "content": "{\"claim\":\"Node.js 20.x is currently in Active LTS.\",\"evidence\":[\"| Node.js 20 | EOL (Apr 30, 2026) | Upgrade to 22/24, or adopt NES |\"]}"
            }
          ]
        },
        "output": "{\"fix\":\"Node.js 20 has an End of Life date of April 30, 2026.\"}"
      }
    ],
    "errors": []
  }
};

export const FIXTURES = [
  {
    ...BIFROST_RECORDED_RUN,
    mode: 'recorded-live',
    title: 'Node.js 20.x: once Active LTS, now end-of-life (real Bifrost run)',
    claims: BIFROST_RECORDED_RUN.claims.map((claim) => ({ ...claim, evidence: claim.evidence.map((e) => ({ ...e, date: null, dateBasis: 'The cited source reports the later EOL date; it does not establish the earlier Active LTS transition.' })) })),
    source: { status: 'RECORDED_LIVE', url: null, publishedDate: null, publishedDateText: '', note: 'Actual Bifrost output is replayed here. Its cited page confirms the later EOL, but not when Active LTS ended; the slider uses the official Node.js maintenance transition date.' },
    collectionMethod: 'Tavily basic search using the Gemini-generated query + Gemini through Bifrost v2.5.0 virtual key',
    runLog: { ...BIFROST_RECORDED_RUN.runLog, note: 'Recorded run: Gemini-generated Tavily query; Gemini extraction, judgment, and rewrite through Bifrost. Replay makes no new external calls.' },
    timelineEvidenceByClaim: {
      c1: [
        { id: 'historical-node20-lts', url: 'https://nodejs.org/en/blog/release/v20.9.0', title: 'Node.js v20.9.0 official release announcement', quote: 'The 20.x release line now moves into "Active LTS"', stance: '지지', citationOk: true, date: '2023-10-24', dateBasis: 'Official Node.js release announcement published 2023-10-24.', collectedAt: '2023-10-24' },
        { id: 'official-node20-eol', url: 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json', title: 'Node.js official release schedule (schedule.json)', quote: '\"v20\":{\"start\":\"2023-04-18\",\"lts\":\"2023-10-24\",\"maintenance\":\"2024-10-22\",\"end\":\"2026-04-30\",\"codename\":\"Iron\"}', stance: '반박', citationOk: true, date: '2024-10-22', dateBasis: 'Official Node.js schedule maintenance date: Active LTS ended and Maintenance LTS began.', collectedAt: '2026-11-10' }
      ]
    }
  },
  {
    id: 'node20-lts-2023',
    mode: 'fixture',
    title: 'Node.js 20.9.0 release announcement (real public document)',
    authoredDate: '2023-10-24',
    answerText:
      "This release marks the transition of Node.js 20.x into Long Term Support (LTS) with the codename 'Iron'. The 20.x release line now moves into \"Active LTS\" and will remain so until October 2024.",
    source: {
      status: 'VERIFIED',
      url: NODE_BLOG_URL,
      publishedDate: '2023-10-24',
      publishedDateText: "2023-10-24, Version 20.9.0 'Iron' (LTS), @richardlau",
      note: 'Two source excerpts are shown verbatim. The answer date matches the announcement date.',
    },
    collectedAt: COLLECTED,
    collectionMethod: MANUAL,
    claims: [
      {
        id: 'c1',
        text: 'The Node.js 20.x release line is in Active LTS.',
        type: '버전',
        relation: '반박',
        evidence: [
          {
            id: 'e0',
            url: NODE_BLOG_URL,
            title: 'Node.js v20.9.0 release blog',
            quote: 'The 20.x release line now moves into "Active LTS"',
            stance: '지지',
            citationOk: true,
            date: '2023-10-24',
            dateBasis: 'Original publication date: 2023-10-24',
            collectedAt: COLLECTED,
          },
          {
            id: 'e1',
            url: NODE_RELEASES_URL,
            title: 'Node.js Releases (previous releases table)',
            quote: 'v20 | Iron | Apr 17, 2023 | Mar 24, 2026 | EOL',
            stance: '반박',
            citationOk: true,
            date: null,
            dateBasis: "The table’s 2026-03-24 “Last updated” value is page metadata, not the EOL event date. The event date is not established by this page.",
            collectedAt: COLLECTED,
          },
        ],
      },
      {
        id: 'c2',
        text: "The codename of Node.js 20.x is 'Iron'.",
        type: '안정 사실',
        relation: '지지',
        evidence: [
          {
            id: 'e2',
            url: NODE_BLOG_URL,
            title: 'Node.js v20.9.0 release blog',
            quote: "This release marks the transition of Node.js 20.x into Long Term Support (LTS) with the codename 'Iron'.",
            stance: '지지',
            citationOk: true,
            date: '2023-10-24',
            dateBasis: 'Official release announcement header date: 2023-10-24',
            collectedAt: COLLECTED,
          },
        ],
      },
      {
        id: 'c3',
        text: 'Node.js 20.x will remain in Active LTS until October 2024.',
        type: '버전',
        relation: '지지',
        relationNote: '',
        evidence: [
          {
            id: 'e3',
            url: NODE_BLOG_URL,
            title: 'Node.js v20.9.0 release blog',
            quote: 'The 20.x release line now moves into "Active LTS" and will remain so until October 2024.',
            stance: '지지',
            citationOk: true,
            date: '2023-10-24',
            dateBasis: 'Official release announcement header date: 2023-10-24',
            collectedAt: COLLECTED,
          },
        ],
      },
    ],
    runLog: FIXTURE_LOG,
  },
  {
    id: 'python312-synthetic-answer',
    mode: 'fixture',
    title: 'Python 3.12 notes (synthetic answer + evidence from real public documents)',
    authoredDate: '2023-10-05',
    answerText: 'Python 3.12 is the latest stable release. Python 3.12 removed the distutils package from the standard library.',
    source: {
      status: 'SYNTHETIC_ANSWER',
      url: null,
      publishedDate: null,
      publishedDateText: '',
      note: 'The answer and its 2023-10-05 date are synthetic demo data. Only the evidence excerpts come from public documents.',
    },
    collectedAt: COLLECTED,
    collectionMethod: MANUAL,
    claims: [
      {
        id: 'c1',
        text: 'Python 3.12 is the latest stable release.',
        type: '버전',
        relation: '반박',
        evidence: [
          {
            id: 'e1',
            url: PY312_URL,
            title: 'What’s New In Python 3.12 — Python 3.15.2 documentation',
            quote: 'What’s New In Python 3.12 — Python 3.15.2 documentation',
            stance: '반박',
            citationOk: true,
            date: null,
            dateBasis: 'Based on the page title only. No publication or update date is shown, so the date is unknown.',
            collectedAt: COLLECTED,
          },
        ],
      },
      {
        id: 'c2',
        text: 'Python 3.12 removed the distutils package from the standard library.',
        type: '안정 사실',
        relation: '지지',
        evidence: [
          {
            id: 'e2',
            url: PY312_URL,
            title: 'What’s New In Python 3.12 — Python 3.15.2 documentation',
            quote: 'Of note, the `distutils` package has been removed from the standard library.',
            stance: '지지',
            citationOk: true,
            date: '2023-10-02',
            dateBasis: "Source text: 'Python 3.12 was released on October 2, 2023.'",
            collectedAt: COLLECTED,
          },
        ],
      },
    ],
    runLog: FIXTURE_LOG,
  },
  {
    id: 'examplecloud-synthetic',
    mode: 'fixture',
    title: 'Fictional service ExampleCloud (fully synthetic · no verified source)',
    authoredDate: '2025-01-15',
    answerText: 'ExampleCloud’s basic plan costs $9 per month. ExampleCloud has 1 million monthly active users.',
    source: {
      status: 'NEEDS_SOURCE_VERIFICATION',
      url: null,
      publishedDate: null,
      publishedDateText: '',
      note: 'ExampleCloud is fictional. With no sources, both claims are classified as insufficient evidence with unknown dates.',
    },
    collectedAt: COLLECTED,
    collectionMethod: 'Synthetic data. No search or external verification.',
    claims: [
      { id: 'c1', text: 'ExampleCloud’s basic plan costs $9 per month.', type: '가격', relation: '근거 부족', evidence: [] },
      { id: 'c2', text: 'ExampleCloud has 1 million monthly active users.', type: '통계', relation: '근거 부족', evidence: [] },
    ],
    runLog: FIXTURE_LOG,
  },
];
