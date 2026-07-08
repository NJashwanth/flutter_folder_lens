import { ShapeId, isShapeId, renderShape, renderFileIcon } from "./shapes";

/**
 * A folder-icon rule. `folderName` is matched by VS Code against folder
 * basenames (icon themes cannot target paths — `lib/models` is not possible,
 * only `models`). `color` is a palette name (below) or a `#rrggbb` hex.
 */
export interface IconRule {
  folderName: string;
  shape: ShapeId;
  color: string;
}

/** Dark-theme and light-theme fills for one palette entry. */
export interface ColorPair {
  dark: string;
  light: string;
}

export const PALETTE: Record<string, ColorPair> = {
  blue: { dark: "#42A5F5", light: "#1976D2" },
  cyan: { dark: "#26C6DA", light: "#0097A7" },
  orange: { dark: "#FFA726", light: "#EF6C00" },
  purple: { dark: "#AB47BC", light: "#7B1FA2" },
  teal: { dark: "#26A69A", light: "#00796B" },
  gray: { dark: "#B0BEC5", light: "#607D8B" },
  green: { dark: "#66BB6A", light: "#2E7D32" },
  yellow: { dark: "#FFCA28", light: "#F9A825" },
  red: { dark: "#EF5350", light: "#C62828" },
  dimmed: { dark: "#78909C", light: "#90A4AE" },
  "android-green": { dark: "#3DDC84", light: "#2BB673" },
  "ios-gray": { dark: "#B0B8C4", light: "#8E959E" },
  "web-blue": { dark: "#64B5F6", light: "#1E88E5" },
  "macos-silver": { dark: "#CFD8DC", light: "#78909C" },
  "windows-blue": { dark: "#4FC3F7", light: "#0078D4" },
  "linux-yellow": { dark: "#FFD54F", light: "#F57F17" },
};

/** Neutral colors for the built-in generic folder / file icons. */
const GENERIC_FOLDER: ColorPair = { dark: "#90A4AE", light: "#78909C" };
const GENERIC_FILE: ColorPair = { dark: "#ABB6C2", light: "#8E9AA6" };

export const DEFAULT_ICON_RULES: readonly IconRule[] = [
  { folderName: "screens", shape: "square", color: "blue" },
  { folderName: "pages", shape: "square", color: "blue" },
  { folderName: "widgets", shape: "triangle", color: "cyan" },
  { folderName: "models", shape: "diamond", color: "orange" },
  { folderName: "providers", shape: "circle", color: "purple" },
  { folderName: "bloc", shape: "circle", color: "purple" },
  { folderName: "cubit", shape: "circle", color: "purple" },
  { folderName: "state", shape: "circle", color: "purple" },
  { folderName: "riverpod", shape: "circle", color: "purple" },
  { folderName: "services", shape: "hexagon", color: "teal" },
  { folderName: "repositories", shape: "hexagon", color: "teal" },
  { folderName: "data", shape: "hexagon", color: "teal" },
  { folderName: "api", shape: "hexagon", color: "teal" },
  { folderName: "utils", shape: "star", color: "gray" },
  { folderName: "helpers", shape: "star", color: "gray" },
  { folderName: "core", shape: "star", color: "gray" },
  { folderName: "test", shape: "shield", color: "green" },
  { folderName: "tests", shape: "shield", color: "green" },
  { folderName: "test_driver", shape: "shield", color: "green" },
  { folderName: "integration_test", shape: "shield", color: "green" },
  { folderName: "assets", shape: "grid", color: "yellow" },
  { folderName: "images", shape: "grid", color: "yellow" },
  { folderName: "fonts", shape: "grid", color: "yellow" },
  { folderName: "android", shape: "folder", color: "android-green" },
  { folderName: "ios", shape: "folder", color: "ios-gray" },
  { folderName: "web", shape: "folder", color: "web-blue" },
  { folderName: "macos", shape: "folder", color: "macos-silver" },
  { folderName: "windows", shape: "folder", color: "windows-blue" },
  { folderName: "linux", shape: "folder", color: "linux-yellow" },
  { folderName: "l10n", shape: "gear", color: "dimmed" },
  { folderName: "generated", shape: "gear", color: "dimmed" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface ResolvedRule {
  folderName: string;
  shape: ShapeId;
  /** Palette name or `rrggbb` — used to build stable icon-definition ids. */
  colorKey: string;
  color: ColorPair;
}

function resolveColor(color: string): { key: string; pair: ColorPair } | undefined {
  const palette = PALETTE[color];
  if (palette) {
    return { key: color, pair: palette };
  }
  if (HEX_RE.test(color)) {
    const hex = color.toLowerCase();
    return { key: hex.slice(1), pair: { dark: hex, light: hex } };
  }
  return undefined;
}

/**
 * Validates + merges rules. Later entries win for the same folder name and
 * user rules always win over defaults. Malformed entries — including
 * 0.1.x-era `{glob, badge}` rules — are skipped, not errors.
 */
export function mergeRules(userRules: unknown, useDefaults: boolean): ResolvedRule[] {
  const byName = new Map<string, ResolvedRule>();
  const layers: unknown[][] = [];
  if (useDefaults) {
    layers.push([...DEFAULT_ICON_RULES]);
  }
  if (Array.isArray(userRules)) {
    layers.push(userRules);
  }
  for (const layer of layers) {
    for (const entry of layer) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const { folderName, shape, color } = entry as Record<string, unknown>;
      if (typeof folderName !== "string" || !folderName.trim() || !isShapeId(shape) || typeof color !== "string") {
        continue;
      }
      const resolved = resolveColor(color);
      if (!resolved) {
        continue;
      }
      const name = folderName.trim().toLowerCase();
      byName.set(name, { folderName: name, shape, colorKey: resolved.key, color: resolved.pair });
    }
  }
  return [...byName.values()].sort((a, b) => a.folderName.localeCompare(b.folderName));
}

/**
 * A base icon theme to layer the Flutter overrides onto. `json` is the parsed
 * theme file of another extension; `pathPrefix` is the relative path from OUR
 * theme directory to THAT theme file's directory (icon paths get rewritten).
 */
export interface BaseTheme {
  json: Record<string, unknown>;
  pathPrefix: string;
}

/** A binary asset to copy from the base theme's directory into ours. */
export interface AssetCopy {
  /** Source path, relative to the base theme's directory (or absolute). */
  from: string;
  /** Destination path, relative to our theme directory. */
  to: string;
}

export interface ThemeFiles {
  /** Serialized theme JSON (stable formatting for byte-level idempotency). */
  themeJson: string;
  /** SVG file name (inside icons/) → file content. */
  icons: Map<string, string>;
  /**
   * Base-theme fonts to copy next to our theme JSON. Icon fonts must live
   * inside our theme directory — VS Code does not load @font-face sources
   * that escape to another extension's install location.
   */
  assets: AssetCopy[];
}

const ICON_DIR = "./icons";

function sortedRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    out[k] = v;
  }
  return out;
}

function rewriteBaseThemePaths(
  json: Record<string, unknown>,
  prefix: string,
): { theme: Record<string, unknown>; assets: AssetCopy[] } {
  const theme = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
  const assets: AssetCopy[] = [];
  const rebase = (p: string): string => {
    if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(p)) {
      return p; // already absolute
    }
    return `${prefix}/${p.replace(/^\.\//, "")}`;
  };
  const defs = theme.iconDefinitions as Record<string, { iconPath?: string }> | undefined;
  if (defs) {
    for (const def of Object.values(defs)) {
      if (def && typeof def.iconPath === "string") {
        def.iconPath = rebase(def.iconPath);
      }
    }
  }
  // Fonts are copied into our theme dir rather than referenced in place:
  // @font-face sources pointing into another extension's directory fail to
  // load, which renders every file icon as the same blank glyph.
  const fonts = theme.fonts as Array<{ src?: Array<{ path?: string }> }> | undefined;
  if (Array.isArray(fonts)) {
    const seen = new Map<string, string>();
    for (const font of fonts) {
      for (const src of font?.src ?? []) {
        if (!src || typeof src.path !== "string") {
          continue;
        }
        const original = src.path;
        let local = seen.get(original);
        if (!local) {
          const base = original.replace(/\\/g, "/").split("/").pop() || "font";
          local = `fonts/${seen.size}_${base}`;
          seen.set(original, local);
          assets.push({ from: original.replace(/^\.\//, ""), to: local });
        }
        src.path = `./${local}`;
      }
    }
  }
  return { theme, assets };
}

/**
 * Builds the complete icon theme: theme JSON + every SVG it references.
 * Pure function of its inputs — callers rely on identical bytes for
 * unchanged configuration to avoid rewrite/reload loops.
 */
export function generateTheme(rules: ResolvedRule[], base?: BaseTheme): ThemeFiles {
  const icons = new Map<string, string>();
  const defs: Array<[string, { iconPath: string }]> = [];
  const folderNames: Array<[string, string]> = [];
  const folderNamesExpanded: Array<[string, string]> = [];
  const lightFolderNames: Array<[string, string]> = [];
  const lightFolderNamesExpanded: Array<[string, string]> = [];

  const addIcon = (id: string, svg: string) => {
    if (!icons.has(`${id}.svg`)) {
      icons.set(`${id}.svg`, svg);
      defs.push([id, { iconPath: `${ICON_DIR}/${id}.svg` }]);
    }
  };

  for (const rule of rules) {
    const baseId = `ffl_${rule.shape}_${rule.colorKey}`;
    addIcon(baseId, renderShape(rule.shape, "closed", rule.color.dark));
    addIcon(`${baseId}_open`, renderShape(rule.shape, "open", rule.color.dark));
    folderNames.push([rule.folderName, baseId]);
    folderNamesExpanded.push([rule.folderName, `${baseId}_open`]);
    if (rule.color.light !== rule.color.dark) {
      addIcon(`${baseId}_lt`, renderShape(rule.shape, "closed", rule.color.light));
      addIcon(`${baseId}_lt_open`, renderShape(rule.shape, "open", rule.color.light));
      lightFolderNames.push([rule.folderName, `${baseId}_lt`]);
      lightFolderNamesExpanded.push([rule.folderName, `${baseId}_lt_open`]);
    }
  }

  let theme: Record<string, unknown>;
  let assets: AssetCopy[] = [];
  if (base) {
    const rewritten = rewriteBaseThemePaths(base.json, base.pathPrefix);
    theme = rewritten.theme;
    assets = rewritten.assets;
    theme.iconDefinitions = {
      ...(theme.iconDefinitions as Record<string, unknown> | undefined),
      ...sortedRecord(defs),
    };
    theme.folderNames = {
      ...(theme.folderNames as Record<string, unknown> | undefined),
      ...sortedRecord(folderNames),
    };
    theme.folderNamesExpanded = {
      ...(theme.folderNamesExpanded as Record<string, unknown> | undefined),
      ...sortedRecord(folderNamesExpanded),
    };
    const light = { ...((theme.light as Record<string, unknown> | undefined) ?? {}) };
    light.folderNames = {
      ...(light.folderNames as Record<string, unknown> | undefined),
      ...sortedRecord(lightFolderNames),
    };
    light.folderNamesExpanded = {
      ...(light.folderNamesExpanded as Record<string, unknown> | undefined),
      ...sortedRecord(lightFolderNamesExpanded),
    };
    theme.light = light;
  } else {
    // Built-in minimal base: clean generic folder + file icons.
    addIcon("ffl_folder", renderShape("folder", "closed", GENERIC_FOLDER.dark));
    addIcon("ffl_folder_open", renderShape("folder", "open", GENERIC_FOLDER.dark));
    addIcon("ffl_folder_lt", renderShape("folder", "closed", GENERIC_FOLDER.light));
    addIcon("ffl_folder_lt_open", renderShape("folder", "open", GENERIC_FOLDER.light));
    addIcon("ffl_file", renderFileIcon(GENERIC_FILE.dark));
    addIcon("ffl_file_lt", renderFileIcon(GENERIC_FILE.light));
    theme = {
      iconDefinitions: sortedRecord(defs),
      file: "ffl_file",
      folder: "ffl_folder",
      folderExpanded: "ffl_folder_open",
      folderNames: sortedRecord(folderNames),
      folderNamesExpanded: sortedRecord(folderNamesExpanded),
      light: {
        file: "ffl_file_lt",
        folder: "ffl_folder_lt",
        folderExpanded: "ffl_folder_lt_open",
        folderNames: sortedRecord(lightFolderNames),
        folderNamesExpanded: sortedRecord(lightFolderNamesExpanded),
      },
      hidesExplorerArrows: false,
    };
  }

  return { themeJson: JSON.stringify(theme, null, 2) + "\n", icons, assets };
}
