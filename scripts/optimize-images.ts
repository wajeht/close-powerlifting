import fs from "fs";
import path from "path";

import sharp from "sharp";

import { createLogger } from "../src/utils/logger";

const logger = createLogger();
const IMG_DIR = path.join(__dirname, "..", "public", "img");

interface OptimizationResult {
  file: string;
  originalSize: number;
  optimizedSize: number;
  savings: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImage(filePath: string): Promise<OptimizationResult | null> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const originalSize = fs.statSync(filePath).size;

  let optimizedBuffer: Buffer;

  if (ext === ".png") {
    optimizedBuffer = await sharp(filePath)
      .png({ compressionLevel: 9, palette: true, quality: 80 })
      .toBuffer();
  } else if (ext === ".webp") {
    optimizedBuffer = await sharp(filePath).webp({ quality: 80, effort: 6 }).toBuffer();
  } else if (ext === ".jpg" || ext === ".jpeg") {
    optimizedBuffer = await sharp(filePath).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  } else {
    return null;
  }

  const optimizedSize = optimizedBuffer.length;

  if (optimizedSize < originalSize) {
    fs.writeFileSync(filePath, optimizedBuffer);
  }

  const savings = originalSize - optimizedSize;
  const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

  return {
    file: fileName,
    originalSize,
    optimizedSize: optimizedSize < originalSize ? optimizedSize : originalSize,
    savings: savings > 0 ? `${formatBytes(savings)} (${savingsPercent}%)` : "no change",
  };
}

async function main() {
  logger.info("Optimizing images in public/img/...");

  const files = fs.readdirSync(IMG_DIR).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return [".png", ".webp", ".jpg", ".jpeg"].includes(ext);
  });

  if (files.length === 0) {
    logger.warn("No images found to optimize.");
    return;
  }

  const results: OptimizationResult[] = [];

  for (const file of files) {
    const filePath = path.join(IMG_DIR, file);
    const result = await optimizeImage(filePath);
    if (result) {
      results.push(result);
    }
  }

  const header = "File".padEnd(30) + "Original".padEnd(12) + "Optimized".padEnd(12) + "Savings";
  const divider = "-".repeat(70);

  const rows = results.map(
    (result) =>
      result.file.padEnd(30) +
      formatBytes(result.originalSize).padEnd(12) +
      formatBytes(result.optimizedSize).padEnd(12) +
      result.savings,
  );

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalOptimized = results.reduce((sum, r) => sum + r.optimizedSize, 0);
  const totalSavings = totalOriginal - totalOptimized;

  const totalRow =
    "Total".padEnd(30) +
    formatBytes(totalOriginal).padEnd(12) +
    formatBytes(totalOptimized).padEnd(12) +
    `${formatBytes(totalSavings)} (${((totalSavings / totalOriginal) * 100).toFixed(1)}%)`;

  const table = [header, divider, ...rows, divider, totalRow].join("\n");

  logger.box("Image Optimization Results", table);
}

main().catch((error) => {
  logger.error(error);
  process.exit(1);
});
