/**
 * Shape SVG library. Every icon is generated from these templates at
 * runtime (parameterized fill), so custom colors need no bundled assets.
 * All output is deterministic — identical input must yield identical bytes,
 * because the regeneration pipeline relies on byte comparison for idempotency.
 */

export const SHAPE_IDS = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "hexagon",
  "star",
  "shield",
  "grid",
  "gear",
  "folder",
] as const;

export type ShapeId = (typeof SHAPE_IDS)[number];

export function isShapeId(value: unknown): value is ShapeId {
  return typeof value === "string" && (SHAPE_IDS as readonly string[]).includes(value);
}

/** Closed = solid fill; open (expanded folder) = outlined variant. */
export type ShapeVariant = "closed" | "open";

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${body}</svg>\n`;
}

function round(n: number): string {
  // toFixed keeps output deterministic across platforms
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/** Regular polygon / star ring: alternating outer+inner radii when rInner is set. */
function ringPoints(cx: number, cy: number, rOuter: number, rInner: number | undefined, n: number, rotDeg: number): string {
  const pts: string[] = [];
  const steps = rInner === undefined ? n : n * 2;
  for (let i = 0; i < steps; i++) {
    const r = rInner === undefined || i % 2 === 0 ? rOuter : rInner;
    const a = ((rotDeg + (360 / steps) * i) * Math.PI) / 180;
    pts.push(`${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`);
  }
  return pts.join(" ");
}

/** Cog outline: slanted teeth, 4 points per tooth. */
function cogPoints(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const pts: string[] = [];
  const step = 360 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [frac, r] of [
      [0.1, rOuter],
      [0.4, rOuter],
      [0.5, rInner],
      [1.0, rInner],
    ] as const) {
      const rad = ((a + frac * step - 90) * Math.PI) / 180;
      pts.push(`${round(cx + r * Math.cos(rad))},${round(cy + r * Math.sin(rad))}`);
    }
  }
  return pts.join(" ");
}

const FOLDER_CLOSED_D =
  "M1.4 4.2c0-.72.58-1.3 1.3-1.3h3.1c.4 0 .78.19 1.02.5l.9 1.2h5.98c.72 0 1.3.58 1.3 1.3v6.2c0 .72-.58 1.3-1.3 1.3H2.7c-.72 0-1.3-.58-1.3-1.3V4.2z";

const FOLDER_OPEN_D =
  "M1.4 4.2c0-.72.58-1.3 1.3-1.3h3.1c.4 0 .78.19 1.02.5l.9 1.2h5.28c.72 0 1.3.58 1.3 1.3v.9H4.1c-.86 0-1.6.58-1.8 1.41l-.9 3.53V4.2z " +
  "M4.3 7.7h9.9c.85 0 1.47.8 1.26 1.62l-.86 3.4c-.15.58-.67.98-1.26.98H3.4c-.85 0-1.47-.8-1.26-1.62l.86-3.4c.15-.58.67-.98 1.26-.98z";

const SHIELD_D =
  "M8 1.2 13.8 3.2V8c0 3.5-2.4 5.8-5.8 6.9C4.6 13.8 2.2 11.5 2.2 8V3.2z";

const CHECK_D = "M6.9 10.4 4.4 7.9 5.5 6.8 6.9 8.2 10.4 4.7 11.5 5.8z";

const FILE_D =
  "M4.2 1.4h5.1c.34 0 .67.14.92.38l2.9 2.9c.24.25.38.58.38.92v8.16c0 .72-.58 1.3-1.3 1.3H4.2c-.72 0-1.3-.58-1.3-1.3V2.7c0-.72.58-1.3 1.3-1.3z";

type Builder = (fill: string) => string;

const CLOSED: Record<ShapeId, Builder> = {
  circle: (f) => `<circle cx="8" cy="8" r="6.2" fill="${f}"/>`,
  square: (f) => `<rect x="2" y="2" width="12" height="12" rx="2.6" fill="${f}"/>`,
  triangle: (f) => `<polygon points="8,1.8 14.6,13.6 1.4,13.6" fill="${f}"/>`,
  diamond: (f) => `<polygon points="8,1.4 14.6,8 8,14.6 1.4,8" fill="${f}"/>`,
  hexagon: (f) => `<polygon points="${ringPoints(8, 8, 6.6, undefined, 6, -90)}" fill="${f}"/>`,
  star: (f) => `<polygon points="${ringPoints(8, 8, 7, 2.9, 5, -90)}" fill="${f}"/>`,
  shield: (f) => `<path d="${SHIELD_D} ${CHECK_D}" fill="${f}" fill-rule="evenodd"/>`,
  grid: (f) =>
    ["2", "8.7"]
      .flatMap((x) => ["2", "8.7"].map((y) => `<rect x="${x}" y="${y}" width="5.3" height="5.3" rx="1.3" fill="${f}"/>`))
      .join(""),
  gear: (f) =>
    `<path d="M${cogPoints(8, 8, 6.8, 5.1, 8)}z M8,6.1 a1.9,1.9 0 1 0 0,3.8 a1.9,1.9 0 1 0 0,-3.8z" fill="${f}" fill-rule="evenodd"/>`,
  folder: (f) => `<path d="${FOLDER_CLOSED_D}" fill="${f}"/>`,
};

const OPEN: Record<ShapeId, Builder> = {
  circle: (f) => `<circle cx="8" cy="8" r="5.5" fill="none" stroke="${f}" stroke-width="1.5"/>`,
  square: (f) => `<rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.2" fill="none" stroke="${f}" stroke-width="1.5"/>`,
  triangle: (f) =>
    `<polygon points="8,3 13.6,12.9 2.4,12.9" fill="none" stroke="${f}" stroke-width="1.5" stroke-linejoin="round"/>`,
  diamond: (f) =>
    `<polygon points="8,2.5 13.5,8 8,13.5 2.5,8" fill="none" stroke="${f}" stroke-width="1.5" stroke-linejoin="round"/>`,
  hexagon: (f) =>
    `<polygon points="${ringPoints(8, 8, 5.9, undefined, 6, -90)}" fill="none" stroke="${f}" stroke-width="1.5" stroke-linejoin="round"/>`,
  star: (f) =>
    `<polygon points="${ringPoints(8, 8, 6.3, 2.6, 5, -90)}" fill="none" stroke="${f}" stroke-width="1.3" stroke-linejoin="round"/>`,
  shield: (f) =>
    `<path d="M8 2 13 3.7V8c0 3-2 5-5 6-3-1-5-3-5-6V3.7z" fill="none" stroke="${f}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polyline points="5.4,8 7.1,9.7 10.7,6.1" fill="none" stroke="${f}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  grid: (f) =>
    ["2.6", "9"]
      .flatMap((x) =>
        ["2.6", "9"].map(
          (y) => `<rect x="${x}" y="${y}" width="4.4" height="4.4" rx="1.1" fill="none" stroke="${f}" stroke-width="1.2"/>`,
        ),
      )
      .join(""),
  gear: (f) =>
    `<polygon points="${cogPoints(8, 8, 6.5, 5, 8)}" fill="none" stroke="${f}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="8" cy="8" r="1.9" fill="none" stroke="${f}" stroke-width="1.2"/>`,
  folder: (f) => `<path d="${FOLDER_OPEN_D}" fill="${f}"/>`,
};

/** Render a complete SVG document for a shape, variant and fill color. */
export function renderShape(shape: ShapeId, variant: ShapeVariant, fill: string): string {
  const builder = variant === "closed" ? CLOSED[shape] : OPEN[shape];
  return svg(builder(fill));
}

/** Generic file icon used as the theme's `file` default. */
export function renderFileIcon(fill: string): string {
  return svg(`<path d="${FILE_D}" fill="${fill}"/>`);
}
