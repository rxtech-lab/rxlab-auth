import { createHash } from "crypto";

interface Color {
  r: number;
  g: number;
  b: number;
}

/**
 * Generate a GitHub-style geometric identicon as an SVG
 * Based on the user's ID or a seed string
 */
export function generateIdenticon(seed: string, size: number = 420): string {
  // Hash the seed to get consistent random values
  const hash = createHash("sha256").update(seed).digest("hex");

  // Generate foreground color from first 6 hex chars
  const color = hexToColor(hash.substring(0, 6));

  // Generate background color (lighter version)
  const bgColor = lightenColor(color, 0.9);

  // Create a 5x5 grid pattern (only need half due to symmetry)
  const gridSize = 5;
  const cellSize = size / gridSize;
  const pattern: boolean[][] = [];

  // Generate pattern from hash
  // Only generate left half + center column, mirror for right half
  for (let row = 0; row < gridSize; row++) {
    pattern[row] = [];
    for (let col = 0; col < Math.ceil(gridSize / 2) + 1; col++) {
      const hashIndex = (row * 3 + col) % 32;
      const value = parseInt(hash[hashIndex], 16);
      pattern[row][col] = value % 2 === 0;
    }
    // Mirror for right half
    for (let col = Math.floor(gridSize / 2) - 1; col >= 0; col--) {
      pattern[row][gridSize - 1 - col] = pattern[row][col];
    }
  }

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

  // Background
  svg += `<rect width="${size}" height="${size}" fill="${colorToHex(bgColor)}"/>`;

  // Pattern cells
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (pattern[row][col]) {
        const x = col * cellSize;
        const y = row * cellSize;
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${colorToHex(color)}"/>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}

/**
 * Generate identicon as a data URL for use in img src
 */
export function generateIdenticonDataUrl(seed: string, size: number = 420): string {
  const svg = generateIdenticon(seed, size);
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate a random seed for new users
 */
export function generateAvatarSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

function hexToColor(hex: string): Color {
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function colorToHex(color: Color): string {
  const r = Math.round(color.r).toString(16).padStart(2, "0");
  const g = Math.round(color.g).toString(16).padStart(2, "0");
  const b = Math.round(color.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function lightenColor(color: Color, factor: number): Color {
  return {
    r: color.r + (255 - color.r) * factor,
    g: color.g + (255 - color.g) * factor,
    b: color.b + (255 - color.b) * factor,
  };
}
