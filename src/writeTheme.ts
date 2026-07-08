import * as fs from "fs";
import * as path from "path";
import { ThemeFiles } from "./theme";

export const THEME_FILE_NAME = "flutter-folder-lens-icon-theme.json";

/**
 * Writes the generated theme into `themeDir` (theme JSON, icons/*.svg and
 * fonts copied from the base theme), touching only files whose content
 * actually changed and deleting files that are no longer referenced.
 * `baseDir` is the directory of the imported base theme's JSON — required to
 * resolve font assets when a base theme is in use. Returns true when anything
 * on disk changed — the caller uses this to decide whether a window reload
 * prompt is needed.
 */
export function writeThemeFiles(themeDir: string, files: ThemeFiles, baseDir?: string): boolean {
  const iconsDir = path.join(themeDir, "icons");
  const fontsDir = path.join(themeDir, "fonts");
  fs.mkdirSync(iconsDir, { recursive: true });
  let changed = false;

  const writeIfChanged = (filePath: string, content: string | Buffer) => {
    let existing: Buffer | undefined;
    try {
      existing = fs.readFileSync(filePath);
    } catch {
      // missing file → write
    }
    const next = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    if (!existing || !existing.equals(next)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, next);
      changed = true;
    }
  };

  writeIfChanged(path.join(themeDir, THEME_FILE_NAME), files.themeJson);
  for (const [name, svg] of files.icons) {
    writeIfChanged(path.join(iconsDir, name), svg);
  }

  const wantedFonts = new Set<string>();
  for (const asset of files.assets) {
    const src = path.isAbsolute(asset.from) ? asset.from : path.resolve(baseDir ?? themeDir, asset.from);
    const dest = path.join(themeDir, asset.to);
    wantedFonts.add(dest);
    try {
      writeIfChanged(dest, fs.readFileSync(src));
    } catch {
      // unreadable source font: skip; affected file icons degrade gracefully
    }
  }

  for (const stale of fs.readdirSync(iconsDir)) {
    if (stale.endsWith(".svg") && !files.icons.has(stale)) {
      fs.unlinkSync(path.join(iconsDir, stale));
      changed = true;
    }
  }
  if (fs.existsSync(fontsDir)) {
    for (const stale of fs.readdirSync(fontsDir)) {
      const full = path.join(fontsDir, stale);
      if (!wantedFonts.has(full)) {
        fs.unlinkSync(full);
        changed = true;
      }
    }
  }
  return changed;
}
