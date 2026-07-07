import * as fs from "fs";
import * as path from "path";
import { ThemeFiles } from "./theme";

export const THEME_FILE_NAME = "flutter-folder-lens-icon-theme.json";

/**
 * Writes the generated theme into `themeDir` (theme JSON + icons/*.svg),
 * touching only files whose content actually changed and deleting SVGs that
 * are no longer referenced. Returns true when anything on disk changed —
 * the caller uses this to decide whether a window reload prompt is needed.
 */
export function writeThemeFiles(themeDir: string, files: ThemeFiles): boolean {
  const iconsDir = path.join(themeDir, "icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  let changed = false;

  const writeIfChanged = (filePath: string, content: string) => {
    let existing: string | undefined;
    try {
      existing = fs.readFileSync(filePath, "utf8");
    } catch {
      // missing file → write
    }
    if (existing !== content) {
      fs.writeFileSync(filePath, content, "utf8");
      changed = true;
    }
  };

  writeIfChanged(path.join(themeDir, THEME_FILE_NAME), files.themeJson);
  for (const [name, svg] of files.icons) {
    writeIfChanged(path.join(iconsDir, name), svg);
  }

  for (const stale of fs.readdirSync(iconsDir)) {
    if (stale.endsWith(".svg") && !files.icons.has(stale)) {
      fs.unlinkSync(path.join(iconsDir, stale));
      changed = true;
    }
  }
  return changed;
}
