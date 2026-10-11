// A job note is a run of "## " sections, and the Job description is written last. A posting's own text often has
// headings of its own ("## About us", "## What you'll do": htmlToText turns every <h1>–<h6> into "## "), so the
// description cannot end at the next "## " the way the other sections do. Until 2026-10 every reader stopped it
// there, and more than half the notes in a real vault lost most of their description to the app, the MCP tools,
// the cover-letter and resume prompts, and rescoring.
//
// Reading: the description runs to the end of the note, or to one of TekJobs' own section headings if a writer
// ever put one after it. Writing: the posting's headings are demoted two levels ("## " becomes "#### "), so a new
// note's sections are unambiguous to Obsidian's outline and to any other reader. Old notes are read as they are;
// nothing rewrites them.

/** The sections TekJobs itself writes into a job note. A posting heading that is exactly one of these would end the
 * description early; that is the trade for a note that some writer appended a section to after its description. */
export const NOTE_SECTIONS = ['Why it matched', 'Status log', 'Notes', 'Application', 'Cover letter', 'Tailored resume', 'People'];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The Job description section of a job note, untrimmed, from the line after its heading. '' when there is none. */
export function descriptionSection(text) {
  const start = String(text).match(/^## Job description[ \t]*\r?\n/m);
  if (!start) return '';
  const rest = text.slice(start.index + start[0].length);
  const end = rest.search(new RegExp(`^## (?:${NOTE_SECTIONS.map(esc).join('|')})[ \\t]*\\r?$`, 'm'));
  return end < 0 ? rest : rest.slice(0, end);
}

/** A posting's text with its headings moved below the note's own: "# "–"#### " gain two levels, deeper ones stay. */
export const demoteHeadings = (md) => String(md || '').replace(/^(#{1,4})(?=[ \t])/gm, '$1##');
