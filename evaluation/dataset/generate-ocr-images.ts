/**
 * Generate synthetic OCR test images for Phase 13 evaluation.
 *
 * Renders known text onto PNGs with various fonts, sizes, and backgrounds
 * matching the categories in ocr-v1.json. Uses node-canvas for reproducibility.
 *
 * Usage: npm run ocr:generate
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "reports", "ocr-images");

// Load ground truth
import { readFileSync } from "fs";
const ocrDataset = JSON.parse(
  readFileSync(join(__dirname, "ocr-v1.json"), "utf-8")
);

interface RenderOptions {
  fontSize: number;
  fontFamily: string;
  bgColor: string;
  textColor: string;
  padding: number;
  width: number;
  height: number;
  textAlign?: CanvasRenderingContext2D["textAlign"];
  backgroundImage?: boolean;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderSample(
  sample: { id: string; category: string; image_file: string; expected_text: string },
  opts: RenderOptions
): void {
  const canvas = createCanvas(opts.width, opts.height);
  const ctx = canvas.getContext("2d");

  // Background
  if (opts.backgroundImage) {
    // Simulate text over image: gradient + noise dots
    const grad = ctx.createLinearGradient(0, 0, opts.width, opts.height);
    grad.addColorStop(0, "#1a2a6c");
    grad.addColorStop(0.5, "#b21f1f");
    grad.addColorStop(1, "#fdbb2d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, opts.width, opts.height);
    // Add some "image" texture
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 500; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * opts.width, Math.random() * opts.height, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, opts.width, opts.height);
  }

  // Text
  ctx.fillStyle = opts.textColor;
  ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;
  ctx.textAlign = opts.textAlign || "left";
  ctx.textBaseline = "top";

  const maxWidth = opts.width - opts.padding * 2;
  const lines = wrapText(ctx, sample.expected_text, maxWidth, opts.fontSize * 1.3);

  const totalHeight = lines.length * opts.fontSize * 1.3;
  let y = (opts.height - totalHeight) / 2 + opts.padding;

  for (const line of lines) {
    const x = opts.textAlign === "center" ? opts.width / 2 : opts.padding;
    ctx.fillText(line, x, y);
    y += opts.fontSize * 1.3;
  }

  const outPath = join(OUTPUT_DIR, sample.image_file);
  if (!existsSync(dirname(outPath))) {
    mkdirSync(dirname(outPath), { recursive: true });
  }
  writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log(`✓ ${sample.id} → ${sample.image_file}`);
}

function getOptsForCategory(category: string): RenderOptions {
  switch (category) {
    case "PLAIN_TEXT":
      return { fontSize: 32, fontFamily: "Arial", bgColor: "#ffffff", textColor: "#000000", padding: 40, width: 900, height: 200 };
    case "SMALL_TEXT":
      return { fontSize: 16, fontFamily: "Arial", bgColor: "#ffffff", textColor: "#000000", padding: 30, width: 800, height: 120 };
    case "LARGE_TEXT":
      return { fontSize: 48, fontFamily: "Impact, Arial Black, sans-serif", bgColor: "#ffffff", textColor: "#000000", padding: 30, width: 1000, height: 150, textAlign: "center" };
    case "DARK_BACKGROUND":
      return { fontSize: 30, fontFamily: "Georgia", bgColor: "#1a1a2e", textColor: "#e0e0e0", padding: 40, width: 900, height: 180 };
    case "BRIGHT_BACKGROUND":
      return { fontSize: 30, fontFamily: "Georgia", bgColor: "#f0f8ff", textColor: "#333333", padding: 40, width: 900, height: 180 };
    case "TEXT_OVER_IMAGE":
      return { fontSize: 34, fontFamily: "Verdana", bgColor: "#000000", textColor: "#ffffff", padding: 40, width: 1000, height: 250, backgroundImage: true };
    case "SOCIAL_MEDIA":
      return { fontSize: 26, fontFamily: "Trebuchet MS", bgColor: "#15202b", textColor: "#ffffff", padding: 30, width: 900, height: 220 };
    case "NEWS_HEADLINE":
      return { fontSize: 36, fontFamily: "Times New Roman", bgColor: "#ffffff", textColor: "#111111", padding: 40, width: 1000, height: 160 };
    case "PARAGRAPH":
      return { fontSize: 22, fontFamily: "Helvetica", bgColor: "#fafafa", textColor: "#222222", padding: 40, width: 1000, height: 400 };
    case "NUMBERS":
      return { fontSize: 30, fontFamily: "Courier New", bgColor: "#ffffff", textColor: "#000000", padding: 40, width: 950, height: 160 };
    case "DATES":
      return { fontSize: 30, fontFamily: "Courier New", bgColor: "#fffef0", textColor: "#000000", padding: 40, width: 950, height: 160 };
    case "PERCENTAGES":
      return { fontSize: 30, fontFamily: "Courier New", bgColor: "#f5f5f5", textColor: "#000000", padding: 40, width: 950, height: 160 };
    case "NAMES":
      return { fontSize: 26, fontFamily: "Georgia", bgColor: "#ffffff", textColor: "#000000", padding: 40, width: 1000, height: 200 };
    default:
      return { fontSize: 30, fontFamily: "Arial", bgColor: "#ffffff", textColor: "#000000", padding: 40, width: 900, height: 200 };
  }
}

function main(): void {
  console.log(`Generating ${ocrDataset.metadata.size} OCR test images...`);
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const sample of ocrDataset.samples) {
    const opts = getOptsForCategory(sample.category);
    renderSample(sample, opts);
  }
  console.log(`\nDone. Images written to: ${OUTPUT_DIR}`);
}

main();
