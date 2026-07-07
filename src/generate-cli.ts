/**
 * Build-time generator: writes the default theme (no user rules, built-in
 * base) into <repo>/theme so the path referenced by contributes.iconThemes
 * exists for F5 sessions and `vsce package`. The extension regenerates the
 * same files at runtime when configuration diverges from the defaults.
 */
import * as path from "path";
import { generateTheme, mergeRules } from "./theme";
import { writeThemeFiles } from "./writeTheme";

const themeDir = path.join(__dirname, "..", "theme");
const changed = writeThemeFiles(themeDir, generateTheme(mergeRules([], true)));
console.log(`[flutter-folder-lens] default theme ${changed ? "written" : "up to date"}: ${themeDir}`);
