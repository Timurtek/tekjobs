// Resume text extraction: PDF (pdf-parse), DOCX (a minimal ZIP reader + word/document.xml), Markdown and plain text.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export async function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === '.pdf') return pdfText(buf);
  if (ext === '.docx') return docxText(buf);
  if (['.md', '.txt', '.markdown'].includes(ext)) return buf.toString('utf8');
  throw new Error(`Unsupported resume format "${ext}". Use PDF, DOCX, Markdown or plain text.`);
}

async function pdfText(buf) {
  let mod;
  try { mod = await import('pdf-parse'); } catch { throw new Error('PDF support needs the pdf-parse package: run `npm install` in the TekJobs folder, or import the resume as DOCX, Markdown or text.'); }
  if (mod.PDFParse) {                                    // pdf-parse v2
    const parser = new mod.PDFParse({ data: buf });
    try { const r = await parser.getText(); return normalize(r.text || ''); } finally { await parser.destroy?.(); }
  }
  const fn = mod.default || mod;                          // pdf-parse v1
  const r = await fn(buf);
  return normalize(r.text || '');
}

/** DOCX is a ZIP; the body is word/document.xml. Paragraphs become lines, runs are joined, tags stripped. */
function docxText(buf) {
  const xml = readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('Not a DOCX file (no word/document.xml inside).');
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return normalize(text);
}

function readZipEntry(buf, wanted) {
  // Walk the central directory (signature 0x02014b50) to find the entry, then read it from its local header.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lnameLen = buf.readUInt16LE(localOffset + 26), lextraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lnameLen + lextraLen;
      const data = buf.subarray(start, start + csize);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const normalize = (s) => s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
