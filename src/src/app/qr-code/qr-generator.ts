/**
 * Minimaler QR-Code-Generator (Version 1–4, Error Correction Level M).
 * Keine externe Abhängigkeit – vollständig in TypeScript implementiert.
 */

// ---------------------------------------------------------------------------
// Galois-Field GF(256) Arithmetik für Reed-Solomon
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function buildGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const factor = [1, GF_EXP[i]];
    const result = new Array(g.length + factor.length - 1).fill(0);
    for (let j = 0; j < g.length; j++)
      for (let k = 0; k < factor.length; k++)
        result[j + k] ^= gfMul(g[j], factor[k]);
    g = result;
  }
  return g;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0)
      for (let j = 1; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], coef);
  }
  return msg.slice(data.length);
}

// ---------------------------------------------------------------------------
// QR-Code Versionsparameter (Version 1–4, Error Correction Level M)
// ---------------------------------------------------------------------------

interface VersionInfo {
  version: number;
  totalCodewords: number;
  ecCodewords: number;   // EC codewords per block
  dataCodewords: number; // data codewords per block
  blocks: number;
  capacity: number;      // max byte-mode capacity
}

const VERSION_INFO: VersionInfo[] = [
  { version: 1,  totalCodewords: 26,   ecCodewords: 10, dataCodewords: 16,  blocks: 1, capacity: 14  },
  { version: 2,  totalCodewords: 44,   ecCodewords: 16, dataCodewords: 28,  blocks: 1, capacity: 26  },
  { version: 3,  totalCodewords: 70,   ecCodewords: 26, dataCodewords: 44,  blocks: 1, capacity: 42  },
  { version: 4,  totalCodewords: 100,  ecCodewords: 36, dataCodewords: 64,  blocks: 1, capacity: 62  },
  { version: 5,  totalCodewords: 134,  ecCodewords: 48, dataCodewords: 86,  blocks: 2, capacity: 84  },
  { version: 6,  totalCodewords: 172,  ecCodewords: 64, dataCodewords: 108, blocks: 2, capacity: 106 },
  { version: 7,  totalCodewords: 196,  ecCodewords: 72, dataCodewords: 124, blocks: 2, capacity: 122 },
  { version: 8,  totalCodewords: 242,  ecCodewords: 88, dataCodewords: 154, blocks: 2, capacity: 152 },
  { version: 9,  totalCodewords: 292,  ecCodewords: 110,dataCodewords: 182, blocks: 2, capacity: 180 },
  { version: 10, totalCodewords: 346,  ecCodewords: 130,dataCodewords: 216, blocks: 4, capacity: 213 },
];

function pickVersion(byteLen: number): VersionInfo {
  const v = VERSION_INFO.find(v => v.capacity >= byteLen);
  if (!v) throw new Error(`URL zu lang für Version 1–10 (max 213 Bytes)`);
  return v;
}

// ---------------------------------------------------------------------------
// Bitstream-Helfer
// ---------------------------------------------------------------------------

class BitBuffer {
  private buf: number[] = [];
  private bitLen = 0;

  put(num: number, bits: number) {
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (num >> i) & 1;
      const byteIdx = this.bitLen >> 3;
      if (byteIdx >= this.buf.length) this.buf.push(0);
      this.buf[byteIdx] |= bit << (7 - (this.bitLen & 7));
      this.bitLen++;
    }
  }

  get length() { return this.bitLen; }
  getBytes() { return [...this.buf]; }
}

// ---------------------------------------------------------------------------
// Datenkodierung (Byte-Mode)
// ---------------------------------------------------------------------------

function encodeData(text: string, version: VersionInfo): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const buf = new BitBuffer();

  buf.put(0b0100, 4);                          // Byte-Mode
  buf.put(bytes.length, version.version < 10 ? 8 : 16); // Zeichenanzahl
  for (const b of bytes) buf.put(b, 8);

  const totalBits = version.dataCodewords * 8;
  buf.put(0, Math.min(4, totalBits - buf.length)); // Terminator
  while (buf.length % 8 !== 0) buf.put(0, 1);     // Auffüllen auf Byte

  const raw = buf.getBytes();
  const pad = [0xec, 0x11];
  while (raw.length < version.dataCodewords) raw.push(pad[(raw.length - bytes.length - 2) % 2] ?? 0xec);

  return raw.slice(0, version.dataCodewords);
}

// ---------------------------------------------------------------------------
// Matrix-Aufbau
// ---------------------------------------------------------------------------

type Cell = 0 | 1 | -1; // 0=weiß, 1=schwarz, -1=unbelegt

function makeMatrix(size: number): Cell[][] {
  return Array.from({ length: size }, () => new Array<Cell>(size).fill(-1));
}

function setFinderPattern(m: Cell[][], r: number, c: number) {
  for (let dr = -1; dr <= 7; dr++)
    for (let dc = -1; dc <= 7; dc++) {
      const row = r + dr, col = c + dc;
      if (row < 0 || row >= m.length || col < 0 || col >= m.length) continue;
      const inOuter = dr >= 0 && dr <= 6 && (dc === 0 || dc === 6);
      const inTop   = dr === 0 || dr === 6;
      const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      m[row][col] = (inOuter || inTop || inInner) ? 1 : 0;
    }
}

function setAlignmentPattern(m: Cell[][], r: number, c: number) {
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const on = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
      m[r + dr][c + dc] = on ? 1 : 0;
    }
}

// Ausrichtungsmuster-Positionen für Version 1–10
const ALIGN_POS: number[][] = [
  [],           // v1
  [],           // v2
  [6, 18],      // v3
  [6, 26],      // v4
  [6, 30],      // v5
  [6, 34],      // v6
  [6, 22, 38],  // v7
  [6, 24, 42],  // v8
  [6, 26, 46],  // v9
  [6, 28, 50],  // v10
];

function placeFunction(m: Cell[][], version: number) {
  const size = m.length;

  // Finder-Muster + Trenner
  setFinderPattern(m, 0, 0);
  setFinderPattern(m, 0, size - 7);
  setFinderPattern(m, size - 7, 0);

  // Timing-Muster
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = m[i][6] = (i % 2 === 0) ? 1 : 0;
  }

  // Dark module
  m[size - 8][8] = 1;

  // Ausrichtungsmuster
  const pos = ALIGN_POS[version] ?? [];
  for (const r of pos)
    for (const c of pos)
      if (m[r][c] === -1) setAlignmentPattern(m, r, c);

  // Format-Info-Reservierung (Platzhalter)
  for (let i = 0; i <= 8; i++) {
    if (m[i][8] === -1) m[i][8] = 0;
    if (m[8][i] === -1) m[8][i] = 0;
    if (m[size - 1 - i] && m[size - 1 - i][8] === -1) m[size - 1 - i][8] = 0;
    if (m[8][size - 1 - i] === -1) m[8][size - 1 - i] = 0;
  }
}

// ---------------------------------------------------------------------------
// Datenbits in Matrix einschreiben (Zick-Zack)
// ---------------------------------------------------------------------------

function placeData(m: Cell[][], bits: number[]) {
  const size = m.length;
  let bitIdx = 0;
  let up = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // Timing-Spalte überspringen
    for (let row = up ? size - 1 : 0; up ? row >= 0 : row < size; up ? row-- : row++) {
      for (let col = right; col >= right - 1; col--) {
        if (m[row][col] !== -1) continue;
        m[row][col] = bitIdx < bits.length ? bits[bitIdx++] as Cell : 0;
      }
    }
    up = !up;
  }
}

// ---------------------------------------------------------------------------
// Maske (Muster 0: (row+col)%2===0)
// ---------------------------------------------------------------------------

function applyMask(m: Cell[][], mask: number): Cell[][] {
  const size = m.length;
  const copy: Cell[][] = m.map(row => [...row]);
  const condition = getMaskCondition(mask);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (copy[r][c] !== -1 && isData(m, r, c) && condition(r, c))
        copy[r][c] = (copy[r][c] ^ 1) as Cell;
  return copy;
}

function getMaskCondition(mask: number): (r: number, c: number) => boolean {
  switch (mask) {
    case 0: return (r, c) => (r + c) % 2 === 0;
    case 1: return (r)    => r % 2 === 0;
    case 2: return (_, c) => c % 3 === 0;
    case 3: return (r, c) => (r + c) % 3 === 0;
    case 4: return (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r, c) => (r * c) % 2 + (r * c) % 3 === 0;
    case 6: return (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0;
    case 7: return (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    default: return () => false;
  }
}

function isData(m: Cell[][], r: number, c: number): boolean {
  const size = m.length;
  // Finder-Bereiche (inkl. Separator)
  if (r < 9 && c < 9) return false;
  if (r < 9 && c >= size - 8) return false;
  if (r >= size - 8 && c < 9) return false;
  // Timing
  if (r === 6 || c === 6) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Format-Information (EC Level M = 00, Maske)
// ---------------------------------------------------------------------------

const FORMAT_INFO: Record<number, number> = {
  0: 0b101010000010010,
  1: 0b101000100100101,
  2: 0b101111001111100,
  3: 0b101101101001011,
  4: 0b100010111111001,
  5: 0b100000011001110,
  6: 0b100111110010111,
  7: 0b100101010100000,
};

function placeFormatInfo(m: Cell[][], mask: number) {
  const size = m.length;
  const fmt = FORMAT_INFO[mask];
  const bits: Cell[] = [];
  for (let i = 14; i >= 0; i--) bits.push(((fmt >> i) & 1) as Cell);

  // Oben-links horizontal
  const hPos = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
  const vPos = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
  for (let i = 0; i < 15; i++) {
    m[vPos[i]][hPos[i]] = bits[i];
    // Kopien
    if (i < 7) m[size - 1 - i][8] = bits[i];
    else if (i === 7) m[8][size - 8] = bits[i];
    else m[8][size - 15 + i] = bits[i];
  }
}

// ---------------------------------------------------------------------------
// Hauptfunktion: URL → Matrix
// ---------------------------------------------------------------------------

export function generateQrMatrix(text: string): boolean[][] {
  const encoded = text;
  const vInfo = pickVersion(new TextEncoder().encode(encoded).length);
  const version = vInfo.version;
  const size = version * 4 + 17;

  const totalData = encodeData(encoded, vInfo);
  const blocks = vInfo.blocks;
  const ecPerBlock = vInfo.ecCodewords;
  const dataPerBlock = Math.floor(vInfo.dataCodewords / blocks);
  const remainder = vInfo.dataCodewords % blocks;

  // Daten auf Blöcke aufteilen
  const dataBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const len = dataPerBlock + (b < remainder ? 1 : 0);
    dataBlocks.push(totalData.slice(offset, offset + len));
    offset += len;
  }

  // EC-Blöcke berechnen
  const ecBlocks = dataBlocks.map(db => rsEncode(db, ecPerBlock));

  // Interleaving: erst alle Datenbytes, dann alle EC-Bytes
  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++)
    for (const db of dataBlocks)
      if (i < db.length) interleaved.push(db[i]);
  for (let i = 0; i < ecPerBlock; i++)
    for (const eb of ecBlocks)
      if (i < eb.length) interleaved.push(eb[i]);

  const bits: number[] = [];
  for (const b of interleaved)
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);

  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const m = makeMatrix(size);
    placeFunction(m, version);
    placeData(m, bits);
    const masked = applyMask(m, mask);
    placeFormatInfo(masked, mask);
    const penalty = calcPenalty(masked);
    if (penalty < bestPenalty) { bestPenalty = penalty; bestMask = mask; }
  }

  const m = makeMatrix(size);
  placeFunction(m, version);
  placeData(m, bits);
  const masked = applyMask(m, bestMask);
  placeFormatInfo(masked, bestMask);

  return masked.map(row => row.map(c => c === 1));
}

// ---------------------------------------------------------------------------
// Straf-Berechnung
// ---------------------------------------------------------------------------

function calcPenalty(m: Cell[][]): number {
  const size = m.length;
  let p = 0;

  // Regel 1 & 2
  for (let r = 0; r < size; r++) {
    let runH = 1, runV = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === m[r][c-1]) { runH++; if (runH === 5) p += 3; else if (runH > 5) p++; }
      else runH = 1;
      if (m[c][r] === m[c-1][r]) { runV++; if (runV === 5) p += 3; else if (runV > 5) p++; }
      else runV = 1;
    }
  }
  // Regel 2: 2x2 Blöcke
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r+1][c] && m[r][c] === m[r][c+1] && m[r][c] === m[r+1][c+1]) p += 3;

  return p;
}
