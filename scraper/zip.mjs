// A small reader for ordinary zip files (stored or deflated entries, no encryption, under 4 GB), enough to read
// a LinkedIn data export in place without unpacking it or adding a dependency.
import fs from 'node:fs';
import zlib from 'node:zlib';

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;

/** The entries of a zip file: name, sizes, and a reader for each. */
export function openZip(file) {
  const buf = fs.readFileSync(file);
  // The end-of-central-directory record is in the last 64 KB (its comment can push it back from the end).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) { if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; } }
  if (eocd < 0) throw new Error(`${file} is not a zip file`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL) throw new Error(`${file}: bad central directory`);
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    // Some Windows archivers write backslashes in entry names; the zip standard, and LinkedIn, use slashes.
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen).replace(/\\/g, '/');
    entries.set(name, { name, method, compressed, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = (name) => {
    const e = entries.get(name);
    if (!e) throw new Error(`${name} is not in ${file}`);
    if (buf.readUInt32LE(e.offset) !== LOCAL) throw new Error(`${file}: bad local header for ${name}`);
    const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
    const raw = buf.subarray(start, start + e.compressed);
    if (e.method === 0) return Buffer.from(raw);
    if (e.method === 8) return zlib.inflateRawSync(raw);
    throw new Error(`${name}: compression method ${e.method} is not supported`);
  };
  return { names: [...entries.keys()], has: (n) => entries.has(n), read, readText: (n) => read(n).toString('utf8') };
}
