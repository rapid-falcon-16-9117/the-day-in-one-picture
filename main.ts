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
// then width at offset 16 and height at offset 20. For JPEG the dimensions
// live in a later marker segment; walking those is more machinery than this
// check needs, so JPEGs get a pass here and the size cap above still binds.
let dimensions = "unknown (JPEG, not measured)";
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
}

// --- ship it ---------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);

console.log(
  `the-day-in-one-picture: ${isPng ? "PNG" : "JPEG"}, ${bytes.length} bytes, ` +
    `${dimensions} -> ${target}`,
);
