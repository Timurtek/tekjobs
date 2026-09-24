/** Everything the landing page says. Numbers come from the repository and one real vault, named beside each. */

export const REPO = "https://github.com/Timurtek/tekjobs";
export const AUTHOR = "https://www.timurtek.com";
export const ZENGIN = "https://zengin.timurtek.com";

export const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "/#how", label: "How it works" },
  { href: "/#boundary", label: "The boundary" },
  { href: "/#post", label: "For employers" },
  { href: "/jobs", label: "Jobs" },
  { href: "/#proof", label: "Numbers" },
  { href: "/docs/getting-started", label: "Docs" },
  { href: REPO, label: "GitHub", external: true },
];

/** Posting a job: the price and the four steps, in the order an employer meets them. */
export const POSTING = {
  price: "$49",
  term: "30 days",
  steps: [
    { title: "Write it", body: "Title, company, location and whether it is remote, the pay range, and the description. The pay range is required: a posting without one scores lower in every TekJobs user's criteria, and most of them have a floor." },
    { title: "Pay once", body: "$49 for 30 days, through Stripe. No subscription, no per-view charge, no upsell. The refund policy is one page." },
    { title: "It enters the morning scan", body: "The posting becomes one more source every TekJobs user's software reads the next morning, scored against that user's own criteria like any Greenhouse or Ashby board. It is never emailed, pushed or promoted; it is found." },
    { title: "Fits apply to you directly", body: "A user whose criteria the posting clears sees it on their Today page with the reasons it scored, and applies through your own link. We are not in the middle of the application, and we never hand you a list of who saw it." },
  ],
  scoresWell: [
    "State the pay range, in the posting itself.",
    "Say remote, hybrid or on-site plainly, with the country or time zone that applies.",
    "Use the real title. Design engineers search for design engineer, not for rockstar.",
    "Describe the work in the description: stack, systems, what the first quarter looks like. Keywords in the text are what the score reads.",
  ],
};

/** The five moments, in the order they happen every day. */
export const STEPS = [
  {
    title: "Scan",
    body: "Every morning: 350-plus company boards on Greenhouse, Lever, Ashby, Workday and the rest, the Google and Apple career pages, and a dozen aggregator feeds. Around 25,000 postings a run, deduplicated. All public, all key-free.",
  },
  {
    title: "Score",
    body: "Each posting is scored against criteria you own: title terms, hard exclusions, description keywords, seniority, a remote rule, a pay floor with a stretch band, recency. Every point is written down as a reason.",
  },
  {
    title: "File",
    body: "A match becomes a markdown note in a folder on your machine: the posting, why it matched, a status log, an application packet. Open the folder in Obsidian or anything else. The notes are the record; nothing else is.",
  },
  {
    title: "Decide",
    body: "Today shows the few worth a decision and what is about to close. Shortlist or pass, with a reason. Mail says reads your inbox for confirmations, rejections and interviews and asks you to confirm each one.",
  },
  {
    title: "Apply",
    body: "A tailored resume and a letter written from your resume of record, checked against it, saved into the note. The copy panel holds the answers forms keep asking for. You review, you click send; the app never does.",
  },
];

/** What the software will not do, stated as plainly as the features. */
export const BOUNDARY = [
  { title: "It never submits an application.", body: "Drafts are written into the note and stop there. Applied, interviewing and offer are statuses only a person can set, because only a person knows." },
  { title: "It never touches LinkedIn on your behalf.", body: "No profile scraping, no automated messages. A single job link you paste is read once, the way a browser would open it." },
  { title: "It never sends mail.", body: "The mail check runs with only Gmail's read tools allowed and every write tool denied by name. The model extracts; matching and every change to a note is ordinary code, and nothing changes until you confirm." },
  { title: "Nothing leaves your computer.", body: "The scan runs on your machine, the notes live in your folder, and the LLM is the coding CLI you already pay for, signed in locally. No accounts, no API keys, no telemetry." },
];

/** Facts a reader can check: the repository, the scan log of one real vault on 2026-09-22. */
export const PROOF = [
  { figure: "356", title: "boards watched", body: "Company boards on nine platforms plus the Atlassian, GitHub, Spotify and Amazon career APIs and the Google and Apple pages, in one daily run." },
  { figure: "25k", title: "postings a run", body: "Fetched, deduplicated across sources, scored, and cut to the ones that clear your bar. About a minute on a laptop." },
  { figure: "39", title: "MCP tools", body: "Claude Code, Claude Desktop, Cursor or ChatGPT can run the whole search over the same notes: find, move, draft, add boards, start scans, read the mailbox." },
  { figure: "0", title: "accounts", body: "No sign-up, no server, no key. A folder of markdown and a scheduled task." },
];

export const REQUIREMENTS = [
  ["Node 20 or newer", "The scraper has one dependency; the app has its own install."],
  ["A folder for your profile", "Plain markdown. Obsidian is the nicest way to read it, and not required."],
  ["A coding CLI, signed in", "Claude Code by default. It writes the letters and resumes and reads the mailbox, so there is no API key and nothing metered."],
  ["Its Gmail connector, for mail", "Optional. Check mail is boxed to Gmail's three read tools."],
] as const;

export const INSTALL = `git clone https://github.com/Timurtek/tekjobs && cd tekjobs
npm install
npm run init -- --resume ~/Downloads/resume.pdf   # the profile folder, with your resume imported

# Then the interview: open Claude Code in app/ and say
#   "Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script."

cd app && npm install
npm run server      # API on http://127.0.0.1:8787
npm run dev         # the app on http://localhost:5173`;

/** Screens on the landing, captured from a running vault. */
export const SCREENS = [
  { src: "/screens/today.png", alt: "Today: the decision queue, in-flight applications, and what has gone quiet", caption: "Today" },
  { src: "/screens/jobs.png", alt: "Jobs: the match list beside the open note, with every reason it scored and the points each one earned", caption: "Jobs" },
  { src: "/screens/pipeline.png", alt: "Pipeline: committed work as columns from reviewing to offer", caption: "Pipeline" },
];
