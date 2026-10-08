/**
 * Everything the landing page says. Two numbers are counted from the repository by `npm run counts` at the root
 * (the MCP tool list and the starter board registry) and land in counts.json; the postings figure is from one real
 * vault, named beside it.
 */
import counts from "./counts.json";

export const REPO = "https://github.com/Timurtek/tekjobs";
export const NPM = "https://www.npmjs.com/package/@timurtekb/tekjobs";
export const PACKAGE = "@timurtekb/tekjobs";
export const AUTHOR = "https://www.timurtek.com";
export const ZENGIN = "https://zengin.timurtek.com";
export const COUNTS: { tools: number; boards: number } = counts;

export const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "/#how", label: "How it works" },
  { href: "/#who", label: "Who it is for" },
  { href: "/#boundary", label: "The boundary" },
  { href: "/#post", label: "For employers" },
  { href: "/jobs", label: "Jobs" },
  { href: "/docs/getting-started", label: "Docs" },
  { href: REPO, label: "GitHub", external: true },
];

/** The first screen: what it is, in the reader's terms, and the four facts on the sheet beneath. */
export const HERO = {
  eyebrow: "Free and open source (MIT). Local-first.",
  title: "A job search that",
  titleEm: "remembers who you are.",
  consequence: "Stop refreshing forty job boards, and stop re-explaining yourself to a chatbot every session.",
  lead:
    "TekJobs turns your resume, your preferences, your decisions and your application history into a career record on your own machine that your AI works from. Every morning it scans hundreds of public company boards, says why each role matched, drafts truthful application material, and stops before anything is sent.",
  coda: "The model can change. Your context stays with you.",
  spec: [
    ["Company boards", `${COUNTS.boards}`],
    ["Postings a run", "25k"],
    ["MCP tools", `${COUNTS.tools}`],
    ["TekJobs accounts", "0"],
  ] as const,
};

/** Posting a job: the price and the four steps, in the order an employer meets them. */
export const POSTING = {
  price: "$49",
  term: "30 days",
  steps: [
    { title: "Write it", body: "Title, company, location and whether it is remote, the pay range and a line on benefits, and the description. The pay range is required: a posting without one scores lower in every TekJobs user's criteria, and most of them have a floor." },
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
    body: `Every morning: the ${COUNTS.boards} company boards in the starter registry (Greenhouse, Lever, Ashby, Workday and the rest), the Google and Apple career pages, a dozen aggregator feeds, and any boards you add. Tens of thousands of postings a run, deduplicated. All public; the company-board scan needs no API key, and the two optional feeds that do (Adzuna, USAJOBS) bring their own free ones.`,
  },
  {
    title: "Score",
    body: "Each posting is scored against criteria you own: title terms, hard exclusions by title and by company, description keywords, seniority, a remote rule, a pay floor with a stretch band, recency. Every point is written down as a reason.",
  },
  {
    title: "File",
    body: "A match becomes a markdown note in a folder on your machine: the posting, why it matched, a status log, an application packet. Open the folder in Obsidian or anything else. The notes are the record; nothing else is.",
  },
  {
    title: "Decide",
    body: "Today shows the few worth a decision and what is about to close. Shortlist or pass, with a reason. The mail pass reads your inbox for confirmations, rejections and interview invitations, the calendar pass reads your Google Calendar for the interviews already on it, and each asks you to confirm before a note moves. Interviews, follow-ups and deadlines then sit on a calendar of their own, with a feed your calendar app can subscribe to.",
  },
  {
    title: "Apply",
    body: "A tailored resume and a letter written from your resume of record, checked against it, saved into the note. The copy panel holds the answers forms keep asking for. You review, you click send; the app never does.",
  },
];

/** Who should install it, and who should not. Written so a reader can rule themselves out in a minute. */
export const WHO = {
  title: "Built for people who want to stay in charge",
  lead:
    "Most AI job-search tools begin with an empty prompt. TekJobs begins with what you already know: your experience, what you want, what you turned down and why, where you applied. Your AI works from that record instead of rediscovering you every session, and the record gets better the longer you search.",
  forTitle: "It fits if",
  for: [
    "You apply across more than one kind of role and want criteria you can read and change.",
    "You want to know why a job was recommended, point by point, before you spend an evening on it.",
    "You already use Claude Code, Codex, Cursor or another MCP client and want it working from your notes.",
    "You keep career notes in Markdown or Obsidian, or would like to start.",
    "You want help with applications without anything being submitted for you.",
  ],
  notTitle: "It does not fit if",
  not: [
    "You want a hosted service with nothing to install. TekJobs is a command and a folder on your machine.",
    "You want one-click applications sent on your behalf. It stops before send, on purpose.",
    "You do not want any AI provider to see your resume. The scan and the notes never leave your machine, but the interview and the drafting send what you choose to the model you connect.",
  ],
};

/** What the software will not do, stated as plainly as the features. */
export const BOUNDARY = [
  { title: "It never submits an application.", body: "Drafts are written into the note and stop there. Applied, interviewing and offer are statuses only a person can set, because only a person knows." },
  { title: "It never touches LinkedIn on your behalf.", body: "No profile scraping, no automated messages. A single job link you paste is read once, the way a browser would open it." },
  { title: "It never sends mail, and never writes to your calendar.", body: "The mail and calendar checks run with only the Gmail and Google Calendar read tools allowed and every write tool denied by name. The model extracts; matching and every change to a note is ordinary code, and nothing changes until you confirm." },
  {
    title: "Your files stay with you.",
    body: "The scan runs on your machine, the notes live in your folder, and there is no TekJobs account or server holding a copy. What does leave: the requests to public job boards, and whatever context you choose to send to the AI provider you connect, which processes it under its own terms. No telemetry, no separate model API key, nothing sent on your behalf.",
  },
];

/** Facts a reader can check: two counted from the repository, two from the author's own vault on 2026-09-22. */
export const PROOF = [
  { figure: `${COUNTS.boards}`, title: "company boards", body: "In the starter registry every new profile folder begins with: eleven board platforms plus the Atlassian, GitHub, Spotify and Amazon career APIs and the Google and Apple pages. Add your own; the author's vault watches 356." },
  { figure: "25k", title: "postings a run", body: "The author's vault, 22 September 2026: fetched, deduplicated across sources, scored, and cut to the ones that clear the bar. About a minute on a laptop." },
  { figure: `${COUNTS.tools}`, title: "MCP tools", body: "Claude Code, Codex, Cursor or Claude Desktop can run the whole search over the same notes: find, move, draft, add boards, start scans, read the mailbox." },
  { figure: "0", title: "TekJobs accounts", body: "No TekJobs account, no hosted search database, no separate model API key. A folder of markdown, a scheduled task, and the AI client you already have." },
];

export const REQUIREMENTS = [
  ["Node 20 or newer", "One command installs it. The scan has one dependency, for reading PDF resumes."],
  ["A folder for your profile", "Plain markdown. Obsidian is the nicest way to read it, and not required."],
  ["An AI client that speaks MCP, signed in", "Claude Code, Codex, Cursor or Claude Desktop. It runs the interview and, over MCP, the search. No separate model API key: TekJobs adds no per-call AI billing, and usage follows the client you already have. The setup for each is one page in the docs."],
  ["Claude Code with its Gmail and Google Calendar connectors, for mail and calendar", "Optional, and the one thing that needs Claude Code specifically. Each check is boxed to that connector's read tools."],
] as const;

export const INSTALL = `npx ${PACKAGE} init ~/Obsidian/JobSearch --resume ~/Downloads/resume.pdf
npm install -g ${PACKAGE}         # so the morning task has a command that lasts

# Connect your AI client. Claude Code is one line; Codex, Cursor and Claude Desktop are in the docs.
claude mcp add tekjobs -- tekjobs mcp

# Then say:
#   "Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script."

tekjobs up           # the app on http://127.0.0.1:8787; stays up until \`tekjobs down\`
tekjobs schedule     # the morning scan, every day at 07:30

# No resume at hand? Look at a finished, fictional search first:
#   npx ${PACKAGE} init --sample && tekjobs up`;

/** The showreel on the landing: 45 seconds of motion graphics over the sample vault. tools/showreel renders it. */
export const SHOWREEL = {
  title: "What it does, in forty-five seconds",
  lead: "The morning scan, the cut to the few that fit, every point written down, the Today list, the pipeline, your AI over MCP, and the one step it leaves to you.",
  src: "/showreel/tekjobs-showreel.mp4",
  vertical: "/showreel/tekjobs-showreel-vertical.mp4",
  square: "/showreel/tekjobs-showreel-square.mp4",
  poster: "/showreel/tekjobs-showreel-poster.jpg",
  alt: "TekJobs showreel: the morning scan, the cut to fourteen matches, a match scored point by point, the Today list, the pipeline, an AI client tailoring a resume over MCP, and the submit button it leaves alone",
  transcript: [
    "07:30. The clock strikes and tekjobs scan runs, daily, while you sleep.",
    "Scan. Rows of boards (Greenhouse, Lever, Ashby, Workday, the big career APIs, remote feeds, job alert emails) light up as the scan passes: 304 company boards, tens of thousands of postings.",
    "The cut. The postings swirl together and fall away until fourteen are left, each with its score.",
    "Score. One match, Staff Design Engineer at Northwind Labs, and why it matched: title +50, seniority +10, description +31, remote +15, pay +17, fresh +25. The points add up on a ring to 148.",
    "Today. A short list, not a feed: six to decide on, best fit first. One goes to reviewing, one is passed, the next goes to reviewing.",
    "Pipeline. The Northwind card is dragged from Applying to Applied, Interviewing, and Offer.",
    "Your AI. In Claude Code: claude mcp add tekjobs -- tekjobs mcp connects 44 tools. \"Tailor my resume for Northwind Labs\" calls application_packet, tailored_resume_materials and save_tailored_resume, and answers that the draft was checked against the resume of record, saved to the note, and nothing was sent.",
    "It stops before send. The application is filled in; the AI's cursor stops short of Submit. You review. You click.",
    "Plain markdown, on your disk: the profile folder's notes, no TekJobs account, MIT open source.",
    "Closing card: TekJobs. A job search that remembers who you are. npx @timurtekb/tekjobs init.",
  ],
  note: "Motion graphics, not a screen recording. The companies are the fictional ones in the sample vault; the reasons, the scores and the tool names are what TekJobs itself writes and serves. The postings count is illustrative. For one real, unedited run, watch the demo below.",
};

/** The recording on the landing: one real run on the fictional sample resume, 57 seconds. */
export const DEMO = {
  title: "Install, be interviewed, see your first Today",
  lead: "Fifty-seven seconds, recorded from one real run on the fictional sample resume: the init command, the interview in Claude Code, the first scan of 304 boards, and the Today page it produced.",
  src: "/demo/tekjobs-demo.mp4",
  poster: "/demo/tekjobs-demo-poster.png",
  alt: "TekJobs demo: the init command, the onboarding interview, the first scan, and the Today page with seven matches to decide on",
  transcript: [
    "Install. In a terminal: npx @timurtekb/tekjobs init ~/Obsidian/JobSearch --resume ~/Downloads/resume.pdf. The output names the profile folder, the four starter notes it created, the resume it imported, and the onboarding steps still open. Then: claude mcp add tekjobs -- tekjobs mcp, which connects the server to Claude Code.",
    "Interview. In Claude Code: \"Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script.\" The model reads the resume and asks eight questions in one message: target titles, seniority, work mode, pay floor and stretch, keywords and exclusions, company stage, links, earliest start. The answers go back in one message; it writes the profile and the criteria and starts a dry scan.",
    "Scan. In the terminal: tekjobs scan. 304 boards in about two minutes, then the top fifteen still open with their scores, companies, titles and locations.",
    "Today. The app's Today page: seven matches to decide on, best fit first, each with company, role, pay band and a Shortlist or Pass button. Then the Jobs page with one note open: every point it scored, written down as a reason.",
    "Closing card: A job search that remembers who you are. Your notes, your criteria, your AI. Nothing is ever submitted for you.",
  ],
  note: "Nothing in it is staged: the terminal output, the interview transcript and the screenshots are from the same run, and only the folder path was shortened. The companies on the Today page are real postings found that morning.",
};

/** Screens on the landing, captured from the fictional sample vault. */
export const SCREENS = [
  { src: "/screens/today.png", alt: "Today: the decision queue, in-flight applications, and what has gone quiet", caption: "Today" },
  { src: "/screens/jobs.png", alt: "Jobs: the match list beside the open note, with every reason it scored and the points each one earned", caption: "Jobs" },
  { src: "/screens/pipeline.png", alt: "Pipeline: committed work as columns from reviewing to offer", caption: "Pipeline" },
];
