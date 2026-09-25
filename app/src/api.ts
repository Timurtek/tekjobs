/** Typed client for the local server (server/index.mjs). Every call goes through /api, which Vite proxies in dev. */

export type Status = "new" | "reviewing" | "applying" | "ready" | "applied" | "interviewing" | "offer" | "rejected" | "passed";
export type PayBand = "floor" | "stretch" | "below" | "unknown";
export type Kind = "design-eng" | "adjacent";

export const STATUSES: Status[] = ["new", "reviewing", "applying", "ready", "applied", "interviewing", "offer", "rejected", "passed"];
export const ACTIVE: Status[] = ["applying", "ready", "applied", "interviewing", "offer"];

export interface JobRow {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  source: string;
  url: string;
  score: number;
  posted: string;
  found: string;
  salary: string;
  salaryMax: number;
  payBand: PayBand;
  status: Status;
  listing: string;
  kind: Kind;
  department: string;
  passedReason?: string;
  /** "link" when the person pasted it (Add by link); "scan" otherwise. */
  addedBy: "scan" | "link";
}
export const PASS_REASONS = ["wrong role shape", "weak evidence match", "compensation", "location or authorisation", "too managerial", "too visual", "too engineering", "stale or duplicate", "company"] as const;
export type PassReason = (typeof PASS_REASONS)[number];

/** A job row with its raw score expressed as a 0-100 fit against what this criteria set can award. */
export interface TodayRow extends JobRow {
  fit: number;
  days?: number;
  closed?: string;
  since?: number;
  due?: string;
  /** How many application fields have something in them. Only set on the `started` section. */
  packet?: number;
  /** Who to write to about this thread, from the note's People section. In-flight sections only. */
  contact?: { id: string; name: string; email: string; role: string; others: number } | null;
  appliedOn?: string;
}
export interface Today {
  generated: string;
  ceiling: number;
  counts: { open: number; unreviewed: number; inFlight: number; closedUnreviewed: number; aging: number; started: number; waiting: number; waitingDays: number };
  sections: {
    triage: TodayRow[];
    started: TodayRow[];
    aging: TodayRow[];
    missed: TodayRow[];
    preparing: TodayRow[];
    followUps: TodayRow[];
    interviewing: TodayRow[];
    /** Applied, nothing back for `waitingDays` or more, oldest first. */
    waiting: TodayRow[];
  };
}
export interface ApplicationField {
  field: string;
  hint: string;
  required: boolean;
}
/** The packet as the server sees it. `ready` means the required fields are filled — nothing more. */
export interface Packet {
  id: string;
  fields: ApplicationField[];
  values: Record<string, string>;
  missing: string[];
  ready: boolean;
  filled: number;
  total: number;
}
export interface Job extends JobRow {
  /** The note on disk, and an obsidian:// link that opens it there. */
  path: string;
  obsidianUrl: string;
  body: string;
  sections: { why: string; log: string; notes: string; application: string; description: string; people: string };
}
export interface Summary {
  open: number;
  byStatus: Partial<Record<Status, number>>;
  byBand: Partial<Record<PayBand, number>>;
  byKind: Partial<Record<Kind, number>>;
  bySource: Record<string, number>;
  designEng: { total: number; floor: number; stretch: number; unknown: number };
  active: number;
  lastRun: RunEntry | null;
  floor: number | null;
  stretch: number | null;
  minScore: number | null;
  /** The best raw score this criteria set can award; fit is score over this. */
  ceiling: number;
  companies: number;
  vault: string;
}
export type RunOutcome = "success" | "partial" | "failed";
export interface RunEntry {
  date?: string;
  when: string;
  /** A dry run scored but wrote nothing. */
  dry: boolean;
  /** schedule (the morning task), app, mcp (an agent), cli, or "" for logs written before this was recorded. */
  via: string;
  outcome: RunOutcome;
  /** Feeds that failed, each "Name (reason)". */
  feedsFailed: string[];
  boardsOk: number;
  boardsTotal: number;
  scanned: number;
  matched: number;
  newMatches: number;
  closed: number;
  seconds: number;
  failed: string;
  /** "Search Criteria (fingerprint)" or the preset the run scored with. */
  criteria?: string;
}
export interface RunDay { date: string; runs: RunEntry[] }
export interface ScanState { running: boolean; startedAt: string | null; finishedAt: string | null; exitCode: number | null; output: string[]; criteria?: string }
export type HealthState = "failed" | "zero" | "stale" | "never" | "ok";
export interface SourceHealth { state: HealthState; lastAttempt: string; lastOk: string; lastOkJobs: number | null; lastError: string; failStreak: number }
export interface Company { name: string; ats: string; slug: string; tier: string; status: string; notes: string; health: SourceHealth }
export interface Feed { key: string; label: string; enabled: boolean; needsKey: boolean; health: Omit<SourceHealth, "failStreak"> }
export interface Criteria { raw: string; parsed: Record<string, unknown> | null; fingerprint?: string; path?: string }
/** A named criteria set under Targets/Criteria/. `active` means it is byte-for-byte the current Search Criteria weights. */
export interface CriteriaPreset { name: string; file: string; valid: boolean; minScore: number | null; floor: number | null; titles: number; fingerprint: string; active: boolean; updated: string }
export interface CriteriaPresetDoc { name: string; file: string; raw: string; parsed: Record<string, unknown> | null; fingerprint: string }
export interface ProfileNote { key: string; title: string; rel: string; path: string; markdown: string; editable: boolean; hint: string; exists: boolean }
export interface ProfileNotes { profile: string; positioning: string; voice: string; resume: string; notes: ProfileNote[] }
export type Level = "ok" | "warn" | "missing" | "info";
/** The profile read as structure, checked against the criteria and the documents. */
export interface ProfileSummary {
  exists: boolean; status: string; updated: string;
  basics: { name: string; location: string; email: string; links: string[]; currentRole: string };
  summary: string;
  targets: { tier: string; title: string; term: string }[];
  constraints: { label: string; profile: string; criteria: string; level: Level }[];
  proofPoints: { text: string; hasNumber: boolean }[];
  documents: { label: string; state: string; level: Level; where: string }[];
  attention: { level: Level; note: string; text: string }[];
  feeds: { produces: string; reads: string }[];
  resumeAgeDays: number | null;
}

export type CoverLetterEmphasis = "auto" | "design-systems" | "ai-product";
export interface CoverLetterOptions { emphasis: CoverLetterEmphasis; length: "short" | "standard"; extra: string }
export interface CoverLetterWarning { kind: "claim" | "style" | "placeholder" | "specific" | "length"; text: string }
/** `saved` is the letter in the note, checked against the resume. `running`/`error` describe the local CLI run. */
export interface CoverLetterState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
  errorKind: "" | "auth" | "missing" | "outdated" | "failed";
  runner: string;
  saved: { text: string; words: number; warnings: CoverLetterWarning[] } | null;
}

export interface TailoredResumeWarning { kind: "trace" | "claim" | "header" | "date" | "style" | "length"; text: string }
export interface TailoredResumeState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
  errorKind: "" | "auth" | "missing" | "outdated" | "failed";
  runner: string;
  saved: { text: string; words: number; bullets: number; warnings: TailoredResumeWarning[] } | null;
}

export interface OnboardingStep { id: string; label: string; done: boolean; how: string }
export interface Onboarding { dir: string; steps: OnboardingStep[]; complete: boolean; jobs: number; profilePath: string }

/** One note in a criteria preview: its stored score and what the proposed set would make it. */
export interface PreviewGroup { key: string; notes: number; aboveBefore: number; aboveAfter: number; changed: number }
export interface PreviewRow { id: string; company: string; title: string; status: Status; before: number; after: number; delta: number }
export interface CriteriaPreview {
  /** The weights fingerprints: when they differ, saving means the existing notes were scored under other rules. */
  fingerprintBefore: string; fingerprintAfter: string; weightsChange: boolean; notesAtCurrent: number;
  byKind: PreviewGroup[]; bySource: PreviewGroup[];
  openNotes: number; changed: number; barBefore: number; barAfter: number; aboveBefore: number; aboveAfter: number;
  rise: PreviewRow[]; fall: PreviewRow[]; enterTop20: PreviewRow[]; leaveTop20: PreviewRow[]; up: PreviewRow[]; down: PreviewRow[];
  covers: string;
}
/** One application email, matched to a note, with what confirming it would do. */
export interface MailItem {
  id: string; company: string; role: string; kind: "confirmation" | "rejection" | "advance" | "scheduling" | "info-request" | "other";
  date: string; gist: string; from: string; fromName?: string; messageId: string; subject: string;
  person?: MailPerson | null;
  /** exact: same title. company: no role named, best note of that company. company-other-role: a role the vault lacks, default is a new note. none: nothing. */
  match: "exact" | "company" | "company-other-role" | "none"; noteId: string; noteTitle: string; noteStatus: string;
  candidates: { id: string; title: string; status: string }[];
  suggestion: { action: "status" | "record" | "create"; status?: string; appliedOn?: string };
  state: "pending" | "confirmed" | "dismissed";
  resolved?: { at: string; action: string; status?: string };
}
/** Pending emails about one application (company + role), the strongest kind speaking for the group. */
export interface MailGroup {
  id: string; ids: string[]; count: number; company: string; role: string; kind: MailItem["kind"]; kinds: MailItem["kind"][];
  date: string; first: string; gist: string; subject: string; from: string; person: MailPerson | null;
  match: MailItem["match"]; noteId: string; noteTitle: string; noteStatus: string; candidates: MailItem["candidates"]; suggestion: MailItem["suggestion"];
}
/** The human who wrote a mail item, when one did; confirming puts them on the note and in People. */
export interface MailPerson { name: string; email: string; role: PersonRole; company: string }
export interface MailState {
  running: boolean; startedAt: string | null; finishedAt: string | null; error: string; errorKind: string; sinceDays: number | null;
  runner: string; lastRun: string | null; lastSinceDays: number | null; items: MailItem[]; groups: MailGroup[];
}

/** ~/.tekjobs/config.json as the app shows it: where the profile folder is, the resume folder, the LLM command. */
export interface Settings {
  configFile: string;
  profile: { active: string; configured: string; fromEnv: boolean; exists: boolean };
  resumeDir: { path: string; configured: string; exists: boolean };
  resumeSource: string;
  llm: { command: string; args: string; configured: boolean };
  contact: string;
}
export interface ResumeFile { name: string; path: string; size: number; modified: string; current: boolean }
export interface Resumes { dir: string; exists: boolean; files: ResumeFile[] }

/** One line the copy panel offers: the label is the button, the value lands on the clipboard. */
export interface Snippet { group: string; label: string; value: string }
export interface Snippets { items: Snippet[]; /** False until Profile/Snippets.md has been saved once; the items are then read from the profile. */ exists: boolean; path: string }

export const PERSON_ROLES =["recruiter", "hiring-manager", "interviewer", "referral", "other"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];
/** One person note under People/: who, where, how to reach them, and the job notes they are on. */
export interface Person {
  id: string; name: string; role: PersonRole; company: string; email: string; links: string;
  created: string; lastContact: string;
  threads: { id: string; role: string; title: string; status: string }[];
  /** Threads whose note is in flight (applying through offer). */
  live: number;
  path: string; obsidianUrl: string;
}
export interface PersonDetail extends Person { about: string; log: string }
/** A person as a job note's People section lists them. */
export interface JobPerson { id: string; name: string; role: string; email: string; context: string }

/** From the LinkedIn import: who you know at a company. `imported` is null before the first import. */
export interface Connection { name: string; title: string; url: string; connectedOn: string; role: string }
export interface Connections { company: string; count: number; people: Connection[]; imported: string | null }
export interface LinkedInCounts { connections: number; threads: number; invitations: number; applications: number; savedJobs: number; answers: number }
export interface LinkedInStatus { imported: string | null; since?: string; source?: string; counts?: LinkedInCounts; self?: string }
export interface LinkedInPreview {
  source: string; kind: string; files: string[]; since: string; self: string; counts: LinkedInCounts;
  people: { candidates: number; chosen: number; onJobNotes: number; sample: { name: string; role: string; company: string; title: string; last: string; messages: number }[] };
  snippets: { new: number; sample: string[] };
  warmPaths: { jobsWithConnections: number; top: { company: string; count: number }[] };
  applicationsSince: number; savedJobsSince: number;
}
export interface LinkedInImportSummary {
  source: string; since: string; dry: boolean; counts: LinkedInCounts; indexPath: string;
  people: { created: number; recognised: number; attached: number; skipped: number; logged: number };
  snippets: { added: number };
}

/** What the search is producing, read from the notes. */
export interface Outcomes {
  /** Found → reviewed → shortlisted → applied → interviewing → offer; rate is the share of the stage before. */
  stages: { stage: string; count: number; rate: number | null }[];
  byKind: { kind: Kind; found: number; applied: number; responded: number; interviewing: number }[];
  thisWeek: { followUps: { id: string; company: string; title: string; due: string; inDays: number }[]; interviewing: { id: string; company: string; title: string }[] };
  funnel: { found: number; reviewed: number; shortlisted: number; applied: number; interviewing: number; offer: number };
  responded: number;
  responseRate: number | null;
  medianDaysToApply: number | null;
  waiting: { total: number; buckets: Record<string, number>; oldest: { id: string; company: string; title: string; appliedOn: string; days: number; source: string }[] };
  bySource: { source: string; applied: number; responded: number; rate: number }[];
  appliedPerWeek: { week: string; n: number }[];
  passed: number;
  rejected: number;
}

/** A named filter set for the Jobs page; `query` is the page's own query string. Kept in Targets/Job Views.md. */
export interface SavedView { name: string; query: string }

/** Counts per filter value under the current filters, each dimension counted with its own filter lifted. */
export interface Facets {
  total: number;
  status: Record<string, number>;
  band: Record<string, number>;
  kind: Record<string, number>;
  source: Record<string, number>;
  company: Record<string, number>;
  remote: { remote: number; onsite: number };
  pay: { stated: number; unstated: number; min: number; max: number; median: number };
}

/** One pasted link, after the import read it. */
export interface ImportResult {
  url: string;
  /** The posting's canonical link (the board's page when the pasted link was a company page or LinkedIn). */
  link?: string;
  ok: boolean;
  added?: boolean;
  id?: string;
  company?: string;
  title?: string;
  location?: string;
  score?: number;
  reason?: string;
  belowMin?: boolean;
  error?: string;
}

export interface JobQuery {
  q?: string;
  /** Comma-separated any-of list matched against the posting's location text. */
  location?: string;
  /** 1 keeps only rows the scan marked remote. */
  remote?: 1;
  /** One status, or several comma-separated; empty or "all" means every status. */
  status?: string;
  /** One pay band or several comma-separated. */
  band?: string;
  kind?: Kind | "all";
  /** One source or several comma-separated; "link" means every job added by pasting a link. */
  source?: string;
  /** One company or several comma-separated, exact names. */
  company?: string;
  /** Annual pay bounds, judged on the top of the stated range. */
  payMin?: number;
  payMax?: number;
  /** 1 keeps only postings that state pay. */
  payKnown?: 1;
  postedDays?: number;
  foundDays?: number;
  maxScore?: number;
  minScore?: number;
  sort?: keyof JobRow;
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

export const api = {
  summary: () => request<Summary>("/api/summary"),
  jobs: (q: JobQuery) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    return request<{ total: number; rows: JobRow[] }>(`/api/jobs?${p}`);
  },
  facets: (q: JobQuery) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    return request<Facets>(`/api/jobs/facets?${p}`);
  },
  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  attachPosting: (id: string, url: string, linkOnly = false) => request<Job & { linkOnly?: boolean; warning?: string }>(`/api/jobs/${encodeURIComponent(id)}/attach`, { method: "POST", body: JSON.stringify({ url, linkOnly }) }),
  settings: () => request<Settings>("/api/settings"),
  saveSettings: (s: { profile?: string; resumeDir?: string; llmCommand?: string; llmArgs?: string; contact?: string }) => request<Settings & { restart: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(s) }),
  resumes: () => request<Resumes>("/api/resumes"),
  useResume: (name: string) => request<{ source: string; chars: number; removed: string[]; added: string[]; stale: unknown[]; files: ResumeFile[] }>("/api/resumes/use", { method: "POST", body: JSON.stringify({ name }) }),
  openResume: (name: string) => request<{ ok: boolean; path: string }>("/api/resumes/open", { method: "POST", body: JSON.stringify({ name }) }),
  revealJob: (id: string) => request<{ ok: boolean; path: string }>(`/api/jobs/${encodeURIComponent(id)}/reveal`, { method: "POST" }),
  importLinks: (urls: string[]) => request<ImportResult[]>("/api/jobs/import", { method: "POST", body: JSON.stringify({ urls }) }),
  today: (cap = 7) => request<Today>(`/api/today?cap=${cap}`),
  setStatus: (id: string, status: Status, reason?: PassReason) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
  addNote: (id: string, note: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ note }) }),
  packet: (id: string) => request<Packet>(`/api/jobs/${encodeURIComponent(id)}/packet`),
  coverLetter: (id: string) => request<CoverLetterState>(`/api/jobs/${encodeURIComponent(id)}/cover-letter`),
  writeCoverLetter: (id: string, opts: CoverLetterOptions) => request<CoverLetterState>(`/api/jobs/${encodeURIComponent(id)}/cover-letter`, { method: "POST", body: JSON.stringify(opts) }),
  tailoredResume: (id: string) => request<TailoredResumeState>(`/api/jobs/${encodeURIComponent(id)}/resume`),
  writeTailoredResume: (id: string, opts: { emphasis: CoverLetterEmphasis; extra: string }) => request<TailoredResumeState>(`/api/jobs/${encodeURIComponent(id)}/resume`, { method: "POST", body: JSON.stringify(opts) }),
  saveTailoredResume: (id: string, text: string) => request<TailoredResumeState>(`/api/jobs/${encodeURIComponent(id)}/resume`, { method: "PUT", body: JSON.stringify({ text }) }),
  resumePrintUrl: (id: string) => `/api/jobs/${encodeURIComponent(id)}/resume.html`,
  saveCoverLetter: (id: string, text: string) => request<CoverLetterState>(`/api/jobs/${encodeURIComponent(id)}/cover-letter`, { method: "PUT", body: JSON.stringify({ text }) }),
  saveApplication: (id: string, field: string, value: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ application: { field, value } }) }),
  runs: () => request<RunDay[]>("/api/runs"),
  scan: () => request<ScanState>("/api/scan"),
  startScan: (dry = false, criteria?: string, retryFailed = false) => request<ScanState>("/api/scan", { method: "POST", body: JSON.stringify({ dry, criteria: criteria || "", retryFailed }) }),
  criteria: () => request<Criteria>("/api/criteria"),
  saveCriteria: (raw: string) => request<Criteria>("/api/criteria", { method: "PUT", body: JSON.stringify({ raw }) }),
  outcomes: () => request<Outcomes>("/api/outcomes"),
  views: () => request<SavedView[]>("/api/views"),
  defaultViews: () => request<(SavedView & { hint: string })[]>("/api/views/defaults"),
  saveViews: (views: SavedView[]) => request<SavedView[]>("/api/views", { method: "PUT", body: JSON.stringify({ views }) }),
  mail: () => request<MailState>("/api/mail"),
  mailCheck: (sinceDays?: number) => request<MailState>("/api/mail/check", { method: "POST", body: JSON.stringify({ sinceDays }) }),
  mailConfirm: (id: string, noteId?: string) => request<MailState>(`/api/mail/${encodeURIComponent(id)}/confirm`, { method: "POST", body: JSON.stringify({ noteId }) }),
  mailConfirmSafe: () => request<MailState & { confirmed: number }>("/api/mail/confirm-safe", { method: "POST" }),
  mailDismiss: (id: string) => request<MailState>(`/api/mail/${encodeURIComponent(id)}/dismiss`, { method: "POST" }),
  previewCriteria: (raw: string) => request<CriteriaPreview>("/api/criteria/preview", { method: "POST", body: JSON.stringify({ raw }) }),
  rescoreNotes: (dry = false) => request<{ total: number; considered: number; alreadyCurrent: number; changed: number; fingerprint: string; dry: boolean }>("/api/rescore", { method: "POST", body: JSON.stringify({ dry }) }),
  criteriaPresets: () => request<CriteriaPreset[]>("/api/criteria/presets"),
  criteriaPreset: (name: string) => request<CriteriaPresetDoc>(`/api/criteria/presets/${encodeURIComponent(name)}`),
  saveCriteriaPreset: (name: string, raw: string) => request<CriteriaPresetDoc>(`/api/criteria/presets/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ raw }) }),
  deleteCriteriaPreset: (name: string) => request<CriteriaPreset[]>(`/api/criteria/presets/${encodeURIComponent(name)}`, { method: "DELETE" }),
  activateCriteriaPreset: (name: string) => request<Criteria>(`/api/criteria/presets/${encodeURIComponent(name)}/activate`, { method: "POST" }),
  profileNotes: () => request<ProfileNotes>("/api/profile"),
  profileSummary: () => request<ProfileSummary>("/api/profile/summary"),
  saveProfileNote: (note: string, markdown: string) => request<{ saved: string }>("/api/profile", { method: "PUT", body: JSON.stringify({ note, markdown }) }),
  snippets: () => request<Snippets>("/api/snippets"),
  saveSnippets: (items: Snippet[]) => request<Snippets>("/api/snippets", { method: "PUT", body: JSON.stringify({ items }) }),
  people: () => request<Person[]>("/api/people"),
  person: (id: string) => request<PersonDetail>(`/api/people/${encodeURIComponent(id)}`),
  addPerson: (p: { name: string; role: PersonRole; company?: string; email?: string; links?: string; about?: string; jobId?: string; context?: string }) => request<PersonDetail>("/api/people", { method: "POST", body: JSON.stringify(p) }),
  attachPerson: (personId: string, jobId: string, role?: PersonRole, context?: string) => request<Job>(`/api/people/${encodeURIComponent(personId)}/attach`, { method: "POST", body: JSON.stringify({ jobId, role, context }) }),
  logContact: (personId: string, text: string, date?: string) => request<PersonDetail>(`/api/people/${encodeURIComponent(personId)}/log`, { method: "POST", body: JSON.stringify({ text, date }) }),
  jobPeople: (id: string) => request<JobPerson[]>(`/api/jobs/${encodeURIComponent(id)}/people`),
  jobConnections: (id: string) => request<Connections>(`/api/jobs/${encodeURIComponent(id)}/connections`),
  linkedinStatus: () => request<LinkedInStatus>("/api/linkedin"),
  linkedinPreview: (source: string, since?: string, everyone?: boolean) => request<LinkedInPreview>("/api/linkedin/preview", { method: "POST", body: JSON.stringify({ source, since, everyone }) }),
  linkedinImport: (source: string, o: { since?: string; everyone?: boolean; writePeople?: boolean; writeSnippets?: boolean; dry?: boolean } = {}) => request<LinkedInImportSummary>("/api/linkedin/import", { method: "POST", body: JSON.stringify({ source, ...o }) }),
  companies: () => request<Company[]>("/api/companies"),
  addCompany: (c: Omit<Company, "status" | "health">) => request<Company[]>("/api/companies", { method: "POST", body: JSON.stringify(c) }),
  feeds: () => request<Feed[]>("/api/feeds"),
  onboarding: () => request<Onboarding>("/api/onboarding"),
  initProfile: () => request<{ dir: string; made: string[] }>("/api/onboarding/init", { method: "POST", body: "{}" }),
  importResume: (path: string) => request<{ original: string; source: string; chars: number }>("/api/onboarding/resume", { method: "POST", body: JSON.stringify({ path }) }),
};

export const money = (n: number) => `$${Math.round(n / 1000)}k`;
export const shortPay = (s: string) => s.replace(/\s*[•·].*$/, "").replace(/\s+/g, " ").trim();
export const daysAgo = (iso: string) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return Number.isFinite(d) ? (d <= 0 ? "today" : `${d}d ago`) : "";
};
export const BAND_LABEL: Record<PayBand, string> = { floor: "Floor", stretch: "Stretch", below: "Below", unknown: "Not stated" };
export const BAND_TONE: Record<PayBand, "success" | "warning" | "neutral" | "primary"> = { floor: "success", stretch: "warning", below: "neutral", unknown: "neutral" };
export const STATUS_TONE: Record<Status, "neutral" | "primary" | "success" | "warning" | "danger"> = { new: "neutral", reviewing: "primary", applying: "primary", ready: "warning", applied: "primary", interviewing: "warning", offer: "success", rejected: "danger", passed: "neutral" };
