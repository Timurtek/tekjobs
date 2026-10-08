/**
 * The content screen a posting passes before it can be saved. The Terms forbid postings that charge applicants,
 * screen by a protected trait, or dress something else up as a job; the webhook publishes the moment Stripe
 * confirms payment, so this is where those promises are kept. Narrow on purpose: it catches the phrases that
 * are never lawful in a job advertisement and sends the posting back to the employer with the phrase quoted.
 * Lawful statements it leaves alone, such as declining visa sponsorship or naming a legal work-authorisation
 * requirement.
 */
const RULES: { why: string; patterns: RegExp[] }[] = [
  {
    why: "Postings may not charge applicants or make them buy anything to apply or start",
    patterns: [
      /\b(application|processing|registration|training|onboarding|background[- ]check|administrative|placement|starter kit|equipment)\s+fee\b/i,
      /\b(pay|deposit|purchase|buy)\b[^.\n]{0,40}\b(to apply|before (you )?start|to get started|for training|your own (starter|kit))/i,
      /\bfee\s+(is\s+)?(required|payable)\s+(to apply|before)/i,
    ],
  },
  {
    why: "Postings may not screen applicants by age",
    patterns: [
      /\b(recent|new)\s+(college\s+)?(grads?|graduates?)\s+only\b/i,
      /\b(under|below|no older than|not older than|younger than)\s+(the age of\s+)?\d{2}\b/i,
      /\b(aged?|ages)\s+\d{2}\s*(-|–|to)\s*\d{2}\b/i,
      /\byoung\s+(and\s+)?(energetic|dynamic|hungry)\b/i,
      /\bdigital native\b/i,
    ],
  },
  {
    why: "Postings may not screen applicants by national origin, race, religion, sex, family status or disability",
    patterns: [
      /\bnative\s+(english|spanish|german|french)\s+speakers?\s*(only|required|preferred)?\b/i,
      /\b(no|without)\s+(disabilities|disabled|handicap)/i,
      /\bable[- ]bodied\b/i,
      /\b(single|unmarried|married|childless)\s+(candidates?|applicants?|people|women|men)\s+(only|preferred)\b/i,
      /\b(men|women|males?|females?|guys)\s+only\b/i,
      /\b(christians?|muslims?|jews|jewish|hindus?|atheists?)\s+only\b/i,
      /\b(whites?|blacks?|asians?|hispanics?|latinos?)\s+only\b/i,
    ],
  },
  {
    why: "Postings are for employment, not recruitment into a scheme",
    patterns: [
      /\bmulti[- ]?level\s+marketing\b/i,
      /\b(mlm|network marketing opportunity)\b/i,
      /\brecruit\s+(your\s+)?(own\s+)?(downline|team members who recruit)/i,
    ],
  },
];

/** The phrases that stop a posting, each with the rule it breaks. Empty means the posting may be saved. */
export function screenPosting(text: string): { phrase: string; why: string }[] {
  const hits: { phrase: string; why: string }[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (!m) continue;
      const phrase = m[0].replace(/\s+/g, " ").trim();
      if (seen.has(phrase.toLowerCase())) continue;
      seen.add(phrase.toLowerCase());
      hits.push({ phrase, why: rule.why });
    }
  }
  return hits;
}
