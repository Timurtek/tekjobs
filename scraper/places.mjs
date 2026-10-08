// Place tags for a posting's location text. Boards write location in a hundred shapes ("Remote · USA",
// "US Remote", "Remote - United States", "Seattle - United States - Seattle, Washington United States",
// "California - San Francisco Metro - Remote") and a person searching wants one word for one place. placesOf
// turns a string into a short list of tags: Remote, countries, US states, cities, regions, each spelled once.
// The Jobs page offers the tags as a picker with counts; the location filter accepts either a tag or a whole
// word in the raw text, so a saved view written for the text keeps working.

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const STATE_BY_NAME = new Map(Object.values(US_STATES).map((n) => [n.toLowerCase(), n]));

// Spellings that mean one place. Keys are the cleaned, lower-cased segment.
const ALIASES = new Map(Object.entries({
  'united states': 'United States', 'united states of america': 'United States', us: 'United States', usa: 'United States', 'u.s': 'United States',
  'u.s.a': 'United States', 'u.s.a.': 'United States', 'u.s.': 'United States', america: 'United States', 'the united states': 'United States', 'us only': 'United States',
  mclean: 'McLean', bangalore: 'Bengaluru', 'district of columbia': 'Washington DC', 'republic of ireland': 'Ireland', 'russian federation': 'Russia',
  'san francisco bay': 'San Francisco', 'greater seattle': 'Seattle', 'seattle metro': 'Seattle', 'greater toronto': 'Toronto', 'greater london': 'London',
  'united kingdom': 'United Kingdom', uk: 'United Kingdom', 'u.k': 'United Kingdom', 'u.k.': 'United Kingdom', england: 'United Kingdom', 'great britain': 'United Kingdom', britain: 'United Kingdom',
  deutschland: 'Germany', germany: 'Germany', 'the netherlands': 'Netherlands', holland: 'Netherlands',
  'new york city': 'New York', nyc: 'New York', 'new york ny': 'New York', manhattan: 'New York', brooklyn: 'New York',
  'washington dc': 'Washington DC', 'washington d.c': 'Washington DC', 'washington d.c.': 'Washington DC', dc: 'Washington DC', 'd.c': 'Washington DC', 'd.c.': 'Washington DC',
  'san francisco bay area': 'San Francisco', 'sf bay area': 'San Francisco', 'bay area': 'San Francisco', sf: 'San Francisco', 'san fran': 'San Francisco',
  la: 'Los Angeles', 'l.a': 'Los Angeles', 'l.a.': 'Los Angeles',
  worldwide: 'Worldwide', global: 'Worldwide', world: 'Worldwide', 'anywhere in the world': 'Worldwide', international: 'Worldwide', everywhere: 'Worldwide',
  'north america': 'North America', americas: 'Americas', 'the americas': 'Americas', emea: 'EMEA', apac: 'APAC', latam: 'LATAM', 'latin america': 'LATAM',
  europe: 'Europe', eu: 'Europe', 'european union': 'Europe', 'us & canada': 'United States; Canada', 'us and canada': 'United States; Canada', 'us/canada': 'United States; Canada',
  'us or canada': 'United States; Canada', 'canada or united states': 'United States; Canada', 'united states or canada': 'United States; Canada',
}));

const CA_PROVINCES = { AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan' };
const PROVINCE_BY_NAME = new Map(Object.values(CA_PROVINCES).map((n) => [n.toLowerCase(), n]));

const REMOTE = /\b(remote|anywhere|distributed|work from home|wfh|telecommute|fully remote|remote-first|remote first|homeoffice|home office)\b/i;
// Words that describe the arrangement, not the place. Removed before a segment is read as a place.
const NOISE = /\b(remote|hybrid|on[- ]?site|in[- ]?office|office|metro|area|region|job|jobs|friendly|first|travel|required|within|in|or|and|only|based|flexible|anywhere|the|preferred|optional|eligible|locations?|position|role|work from home|wfh|fully|all|any|open to|across|headquarters|hq|considered|async|distributed|homeoffice|hub cities|time ?zones?|cet|est|pst|utc)\b/gi;
// A segment with a street in it is an address, not a place to filter by.
const ADDRESS = /\b(st|ste|suite|street|ave|avenue|blvd|boulevard|pkwy|parkway|rd|road|dr|drive|floor|fl|place|way|lane|ln)\b/i;

/** "san francisco" to "San Francisco"; "McLean" stays "McLean"; "USA" never reaches here. */
const titleCase = (s) => s.replace(/(^|[\s'-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());

const clean = (seg) => seg
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[0-9]+/g, ' ')
  .replace(NOISE, ' ')
  .replace(/[()[\]{}"'“”‘’#*+_~`!?]/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^[\s.,:;/|·•—–-]+|[\s,:;/|·•—–-]+$/g, '')
  .trim();

/**
 * The place tags of a location string, in the order they appear, each once. A US state (by name or two-letter
 * code) adds United States too, so one tag finds every posting in the country however the board wrote it.
 */
export function placesOf(location) {
  const text = String(location || '').trim();
  if (!text) return [];
  const out = [];
  const add = (p) => { if (p && !out.includes(p)) out.push(p); };
  if (REMOTE.test(text)) add('Remote');
  // Split on every separator a board uses between places; a comma inside "Seattle, WA" is a separator too, and
  // the state code then stands on its own, which is what we want.
  const segments = text.split(/\s*(?:;|\||·|•|\/|\\|,|\s[-—–]\s|\(|\)|\bor\b|\band\b|&)\s*/i);
  // A very long list was cut by the board or the feed mid-word ("Maryland - Wa"); its tail is not a place.
  if (text.length >= 250) segments.pop();
  const place = (raw) => {
    const seg = clean(raw);
    if (!seg || (seg.includes(' ') && ADDRESS.test(seg))) return;
    let low = seg.toLowerCase().replace(/\.$/, '');
    // "US-CA-Menlo Park", "USA-NC": country, state, city run together with hyphens.
    const coded = low.match(/^(?:us|usa)-([a-z]{2})(?:-(.+))?$/);
    if (coded) { add('United States'); if (US_STATES[coded[1].toUpperCase()]) add(US_STATES[coded[1].toUpperCase()]); if (coded[2]) place(coded[2]); return; }
    // "California 94104 United States" (digits already gone): the country at the end names itself; the rest is a place.
    const tail = low.match(/^(.+?)\s+(united states|usa|us|canada|united kingdom|uk|germany|india)$/);
    if (tail) { place(tail[2]); place(tail[1]); return; }
    const alias = ALIASES.get(low);
    if (alias) { alias.split('; ').forEach(add); if (alias === 'Washington DC') add('United States'); return; }
    const code = seg.toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && US_STATES[code]) { add(US_STATES[code]); add('United States'); return; }
    if (/^[A-Z]{2}$/.test(code) && CA_PROVINCES[code]) { add(CA_PROVINCES[code]); add('Canada'); return; }
    if (STATE_BY_NAME.has(low)) { add(STATE_BY_NAME.get(low)); add('United States'); return; }
    if (PROVINCE_BY_NAME.has(low)) { add(PROVINCE_BY_NAME.get(low)); add('Canada'); return; }
    // What is left is a city or a country spelled plainly. Keep it when it reads like a name: letters, up to
    // four words, long enough not to be a cut-off word ("Rem").
    if (!/^[\p{L}][\p{L}.' -]*$/u.test(seg) || seg.split(' ').length > 4 || seg.length < 4) return;
    add(titleCase(seg));
  };
  segments.forEach(place);
  return out;
}

/** Counts of each place across rows that carry `places`, for the picker. */
export function countPlaces(rows) {
  const counts = {};
  for (const r of rows) for (const p of r.places || []) counts[p] = (counts[p] || 0) + 1;
  return counts;
}
