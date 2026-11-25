// the-day-in-one-picture — entry program for make.fun's news-image-20261125.
//
// The artwork itself (entry.png, a one-page newspaper front page summing up
// the world news of Wednesday 25 November 2026) is committed next to this
// file. My job here is small but strict: check the image really is what the
// competition allows — a PNG or JPEG, at most 1 MiB, at most 1024x1024 —
// and only then copy it to the output directory. If anything is off I fail
// loudly with exit code 1 instead of handing in a broken entry.
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Node 22, no dependencies.

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1_048_576; // 1 MiB, the competition's size cap
const MAX_SIDE = 1024; // neither width nor height may exceed this

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "entry.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const target = join(outDir, "entry.png");

function fail(message: string): never {
  console.error(`the-day-in-one-picture: ${message}`);
  process.exit(1);
}

const bytes = readFileSync(source);

// --- how big is the file? -------------------------------------------------
if (bytes.length === 0) fail("entry.png is empty");
if (bytes.length > MAX_BYTES) {
  fail(`entry.png is ${bytes.length} bytes, over the ${MAX_BYTES}-byte cap`);
}

// --- what format is it, really? (trust the magic bytes, not the name) -----
const isPng =
  bytes.length >= 8 &&
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
  bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
const isJpeg =
  bytes.length >= 3 &&
  bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

if (!isPng && !isJpeg) {
  fail("entry.png starts with neither the PNG nor the JPEG signature");
}

// --- dimensions ------------------------------------------------------------
// PNG stores width and height as big-endian uint32s in the IHDR chunk,
// which begins right after the 8-byte signature: length(4) "IHDR"(4),
// then width at offset 16 and height at offset 20. JPEG keeps them in a
// Start Of Frame segment, so for a JPEG I walk the marker segments: each
// is 0xFF, a marker byte, and (for most) a two-byte length that counts
// itself; stand-alone markers (TEM, RSTn, SOI, EOI) carry no length. The
// first SOF0/SOF1/SOF2 segment holds precision(1), height(2), width(2).
function jpegDimensions(data: Buffer): { width: number; height: number } | null {
  let at = 2; // skip the SOI marker the signature check already confirmed
  while (at + 3 < data.length) {
    if (data[at] !== 0xff) return null;
    const marker = data[at + 1]!;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const length = data.readUInt16BE(at + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc2) {
      if (at + 9 > data.length) return null;
      return { height: data.readUInt16BE(at + 5), width: data.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  return null;
}

let dimensions = "unknown";
if (isPng) {
  if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") {
    fail("entry.png has a PNG signature but no readable IHDR chunk");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width === 0 || height === 0) fail(`PNG dimensions are ${width}x${height}`);
  if (width > MAX_SIDE || height > MAX_SIDE) {
    fail(`PNG is ${width}x${height}, over the ${MAX_SIDE}x${MAX_SIDE} limit`);
  }
  dimensions = `${width}x${height}`;
} else {
  const found = jpegDimensions(bytes);
  if (found === null) fail("entry.png has a JPEG signature but no readable frame segment");
  if (found.width > MAX_SIDE || found.height > MAX_SIDE) {
    fail(`JPEG is ${found.width}x${found.height}, over the ${MAX_SIDE}x${MAX_SIDE} limit`);
  }
  dimensions = `${found.width}x${found.height}`;
}

// --- ship it ---------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);
const fingerprint = createHash("sha256").update(bytes).digest("hex").slice(0, 16);

console.log(
  `the-day-in-one-picture: ${isPng ? "PNG" : "JPEG"}, ${bytes.length} bytes, ` +
    `${dimensions}, sha256 ${fingerprint}… -> ${target}`,
);
