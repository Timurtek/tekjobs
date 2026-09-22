const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pull an annual USD pay range out of free text. Returns { min, max } in dollars or null. */
export function parseSalary(text = '') {
  const t = text.replace(/–|—/g, '-');
  const num = (s, k) => { let n = parseFloat(s.replace(/,/g, '')); if (k) n *= 1000; return n; };
  const re = /\$\s?(\d{2,3}(?:,\d{3})?(?:\.\d+)?)\s?(k)?\s?(?:-|to|–)\s?\$?\s?(\d{2,3}(?:,\d{3})?(?:\.\d+)?)\s?(k)?/gi;
  let best = null, m;
  while ((m = re.exec(t))) {
    let lo = num(m[1], m[2]), hi = num(m[3], m[4]);
    if (lo < 1000) lo *= 1000; if (hi < 1000) hi *= 1000;      // "$180-250" style
    if (lo < 60000 || hi > 1500000 || hi < lo) continue;        // hourly rates, equity %, junk
    if (!best || hi > best.max) best = { min: lo, max: hi };
  }
  return best;
}
const wordHit = (hay, term) => new RegExp(`(^|[^a-z0-9])${esc(term)}([^a-z0-9]|$)`, 'i').test(hay);

/** Returns { score, reasons[], excluded } for one normalized job against the criteria JSON. */
export function scoreJob(job, c) {
  const title = (job.title || '').toLowerCase();
  const desc = (job.descriptionText || '').toLowerCase();
  const loc = (job.location || '').toLowerCase();
  const reasons = [];
  let score = 0;

  for (const ex of c.titleExclude || []) {
    if (title.includes(ex.toLowerCase())) return { score: -999, reasons: [`excluded by title: "${ex}"`], excluded: true };
  }

  const titleHits = Object.entries(c.titleTerms || {})
    .filter(([t]) => title.includes(t.toLowerCase()))
    .sort((a, b) => b[1] - a[1]);
  if (titleHits.length) {
    // The best-matching term carries the weight; extra hits add a little and then stop. Uncapped, a title
    // that happens to contain four of your terms outranks a better job whose title contains one, which is
    // rewarding vocabulary rather than fit.
    const extra = Math.min((titleHits.length - 1) * (c.titleExtraPer ?? 5), c.titleExtraCap ?? 10);
    const pts = titleHits[0][1] + extra;
    score += pts;
    reasons.push(`title +${pts}: ${titleHits.map((h) => h[0]).join(', ')}`);
  } else {
    const pen = c.noTitleMatchPenalty ?? -40;
    score += pen;
    reasons.push(`no title match ${pen}`);
  }

  for (const [t, w] of Object.entries(c.seniority?.boost || {})) {
    if (wordHit(title, t)) { score += w; reasons.push(`seniority +${w} (${t})`); break; }
  }
  for (const [t, w] of Object.entries(c.seniority?.penalty || {})) {
    if (wordHit(title, t)) { score += w; reasons.push(`seniority ${w} (${t})`); break; }
  }

  let d = 0; const dhits = [];
  for (const [t, w] of Object.entries(c.descTerms || {})) {
    if (desc.includes(t.toLowerCase())) { d += w; dhits.push(t); }
  }
  d = Math.min(d, c.descCap ?? 35);
  if (dhits.length) { score += d; reasons.push(`description +${d}: ${dhits.join(', ')}`); }

  const L = c.location || {};
  const isRemote = !!job.remote || /\bremote\b/.test(loc);
  const bay = (L.bayAreaTerms || []).some((t) => loc.includes(t));
  const us = (L.usTerms || []).some((t) => wordHit(loc, t));
  const nonUs = (L.nonUsTerms || []).some((t) => wordHit(loc, t));
  if (isRemote) { score += L.remoteBoost ?? 0; reasons.push(`remote +${L.remoteBoost ?? 0}`); }
  else if (L.requireRemote) { score += L.notRemotePenalty ?? -60; reasons.push(`not remote ${L.notRemotePenalty ?? -60}`); }
  if (bay) { score += L.bayAreaBoost ?? 0; reasons.push(`bay area +${L.bayAreaBoost ?? 0}`); }
  if (nonUs && !us && !bay) { score += L.nonUsPenalty ?? 0; reasons.push(`non-US location ${L.nonUsPenalty ?? 0}`); }

  const S = c.salary || {};
  let payBand = 'unknown';
  if (S.minAnnual && job.salaryMax) {
    const top = `$${Math.round(job.salaryMax / 1000)}k`;
    if (job.salaryMax >= S.minAnnual) {
      payBand = 'floor';
      // Clearing the floor is worth a fixed amount; clearing it by a lot is worth more. A flat bonus made
      // a job topping out at the floor and one topping out 40% above it score identically, which is the
      // opposite of how a person reads the same two numbers. Capped, so pay cannot dominate fit.
      const over = Math.max(0, job.salaryMax - S.minAnnual);
      const bonus = Math.min(Math.round((over / 10000) * (S.abovePer10k ?? 1)), S.aboveCap ?? 15);
      score += (S.meetsBonus ?? 10) + bonus;
      reasons.push(`pay range tops out at ${top}, at or above floor (+${S.meetsBonus ?? 10}${bonus ? `, +${bonus} for ${Math.round(over / 1000)}k above` : ''})`);
    }
    else if (S.stretchAnnual && job.salaryMax >= S.stretchAnnual) { payBand = 'stretch'; score += S.stretchPenalty ?? -8; reasons.push(`pay range tops out at ${top}, stretch band (${S.stretchPenalty ?? -8})`); }
    else { payBand = 'below'; score += S.belowPenalty ?? -30; reasons.push(`pay range tops out at ${top}, under floor (${S.belowPenalty ?? -30})`); }
  }
  job.payBand = payBand;

  if (job.posted) {
    const days = (Date.now() - new Date(job.posted).getTime()) / 86400000;
    if (Number.isFinite(days)) {
      // Measured on a real vault: every listing that closed did so within seven days of being found, median
      // two. A posting is perishable, so the fresh end of this scale needs more resolution than the stale
      // end — without a days2 tier, something posted today and something posted four weeks ago differ by
      // five points, which is less than one description keyword.
      const r = c.recency || {};
      const add = days <= 2 ? r.days2 ?? r.days7 ?? 0
        : days <= 7 ? r.days7 ?? 0
        : days <= 30 ? r.days30 ?? 0
        : days <= 90 ? r.days90 ?? 0
        : r.older ?? 0;
      score += add;
      reasons.push(`posted ${Math.max(0, Math.round(days))}d ago (${add >= 0 ? '+' : ''}${add})`);
    }
  }

  return { score: Math.round(score), reasons, excluded: false, payBand };
}
