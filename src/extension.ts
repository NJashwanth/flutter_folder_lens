import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { SHAPE_IDS, ShapeId } from "./shapes";
import { BaseTheme, IconRule, PALETTE, generateTheme, mergeRules } from "./theme";
import { writeThemeFiles } from "./writeTheme";

const CONFIG_SECTION = "flutterFolderLens";
const THEME_ID = "flutter-folder-lens";
const STATE_ACTIVATE_PROMPTED = "ffl.activatePrompted";
const STATE_LAST_BASE_THEME = "ffl.lastBaseTheme";

const SHAPE_LABELS: Record<ShapeId, string> = {
  circle: "Circle — state management",
  square: "Square — screens / pages",
  triangle: "Triangle — widgets",
  diamond: "Diamond — models",
  hexagon: "Hexagon — services / data",
  star: "Star — utils / core",
  shield: "Shield (check) — tests",
  grid: "Grid — assets",
  gear: "Gear — generated code",
  folder: "Folder — plain tinted folder",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function activate(context: vscode.ExtensionContext): void {
  regenerate(context, { announce: false }).then(() => maybePromptActivation(context));

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        void regenerate(context, { announce: false });
      }
      if (e.affectsConfiguration("workbench.iconTheme")) {
        rememberBaseTheme(context);
      }
    }),
    vscode.commands.registerCommand("flutterFolderLens.setIconForFolder", (uri?: vscode.Uri) =>
      setIconForFolder(uri),
    ),
    vscode.commands.registerCommand("flutterFolderLens.regenerateIcons", () =>
      regenerate(context, { announce: true }),
    ),
    vscode.commands.registerCommand("flutterFolderLens.resetToDefaults", () => resetToDefaults()),
  );
}

/** Track the most recent non-FFL icon theme so baseIconTheme:"auto" has a target. */
function rememberBaseTheme(context: vscode.ExtensionContext): void {
  const current = vscode.workspace.getConfiguration("workbench").get<string>("iconTheme");
  if (current && current !== THEME_ID) {
    void context.globalState.update(STATE_LAST_BASE_THEME, current);
  }
}

interface RegenerateOptions {
  /** Show a status message even when nothing changed (manual command). */
  announce: boolean;
}

async function regenerate(context: vscode.ExtensionContext, options: RegenerateOptions): Promise<void> {
  rememberBaseTheme(context);
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rules = mergeRules(config.get("rules", []), config.get<boolean>("useDefaultRules", true));
  const themeDir = path.join(context.extensionUri.fsPath, "theme");

  let base: BaseTheme | undefined;
  const baseSetting = (config.get<string>("baseIconTheme", "") ?? "").trim();
  if (baseSetting) {
    base = loadBaseTheme(context, baseSetting, themeDir);
    if (!base) {
      void vscode.window.showWarningMessage(
        `Flutter Folder Lens: could not load base icon theme "${baseSetting}"; using the built-in base instead.`,
      );
    }
  }

  let changed: boolean;
  try {
    changed = writeThemeFiles(themeDir, generateTheme(rules, base));
  } catch (err) {
    void vscode.window.showErrorMessage(`Flutter Folder Lens: failed to generate icons — ${String(err)}`);
    return;
  }

  if (changed) {
    const active = vscode.workspace.getConfiguration("workbench").get<string>("iconTheme") === THEME_ID;
    if (active) {
      const pick = await vscode.window.showInformationMessage(
        "Flutter Folder Lens icons were updated. Reload the window to apply them.",
        "Reload Window",
      );
      if (pick === "Reload Window") {
        void vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }
  } else if (options.announce) {
    vscode.window.setStatusBarMessage("Flutter Folder Lens: icons are up to date.", 3000);
  }
}

/**
 * Resolve a base icon theme by id ("auto" = the icon theme that was active
 * before ours). Returns the parsed theme JSON plus the relative path prefix
 * from our theme dir to that theme's directory, so icon paths keep working.
 */
function loadBaseTheme(
  context: vscode.ExtensionContext,
  setting: string,
  themeDir: string,
): BaseTheme | undefined {
  let themeId = setting;
  if (setting === "auto") {
    const current = vscode.workspace.getConfiguration("workbench").get<string>("iconTheme");
    themeId =
      current && current !== THEME_ID
        ? current
        : (context.globalState.get<string>(STATE_LAST_BASE_THEME) ?? "");
  }
  if (!themeId || themeId === THEME_ID) {
    return undefined;
  }
  for (const ext of vscode.extensions.all) {
    const themes = (ext.packageJSON?.contributes?.iconThemes ?? []) as Array<{ id?: string; path?: string }>;
    const match = themes.find((t) => t.id === themeId && typeof t.path === "string");
    if (!match) {
      continue;
    }
    const themeFile = path.join(ext.extensionUri.fsPath, match.path as string);
    try {
      const json = JSON.parse(stripJsonComments(fs.readFileSync(themeFile, "utf8"))) as Record<string, unknown>;
      const prefix = path.relative(themeDir, path.dirname(themeFile)).split(path.sep).join("/");
      return { json, pathPrefix: prefix };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Theme files are JSONC: strip // and block comments plus trailing commas. */
function stripJsonComments(text: string): string {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      inLine = true;
      i++;
    } else if (ch === "/" && next === "*") {
      inBlock = true;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

async function maybePromptActivation(context: vscode.ExtensionContext): Promise<void> {
  const workbench = vscode.workspace.getConfiguration("workbench");
  if (workbench.get<string>("iconTheme") === THEME_ID || context.globalState.get(STATE_ACTIVATE_PROMPTED)) {
    return;
  }
  await context.globalState.update(STATE_ACTIVATE_PROMPTED, true);
  const pick = await vscode.window.showInformationMessage(
    "Flutter Folder Lens now provides a file icon theme with Flutter-role folder icons. Activate it?",
    "Activate",
    "Not Now",
  );
  if (pick === "Activate") {
    rememberBaseTheme(context);
    await workbench.update("iconTheme", THEME_ID, vscode.ConfigurationTarget.Global);
  }
}

async function setIconForFolder(uri?: vscode.Uri): Promise<void> {
  let folderName: string | undefined;
  if (uri) {
    folderName = path.basename(uri.fsPath);
  } else {
    folderName = await vscode.window.showInputBox({
      prompt: "Folder name to assign an icon to (matched by name anywhere, not by path)",
      placeHolder: "genkit",
      validateInput: (v) => (v.trim() && !v.includes("/") && !v.includes("\\") ? undefined : "Enter a plain folder name"),
    });
  }
  if (!folderName) {
    return;
  }
  folderName = folderName.trim().toLowerCase();

  const shapePick = await vscode.window.showQuickPick(
    SHAPE_IDS.map((id) => ({ label: id, description: SHAPE_LABELS[id] })),
    { placeHolder: `Icon shape for "${folderName}" folders` },
  );
  if (!shapePick) {
    return;
  }

  const colorPick = await vscode.window.showQuickPick(
    [
      ...Object.keys(PALETTE).map((name) => ({ label: name, description: PALETTE[name].dark })),
      { label: "Custom…", description: "Hex color, e.g. #E53935" },
    ],
    { placeHolder: "Icon color" },
  );
  if (!colorPick) {
    return;
  }
  let color = colorPick.label;
  if (color === "Custom…") {
    const input = await vscode.window.showInputBox({
      prompt: "Hex color",
      value: "#E53935",
      validateInput: (v) => (HEX_RE.test(v.trim()) ? undefined : "Use #rrggbb format"),
    });
    if (!input) {
      return;
    }
    color = input.trim();
  }

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rules = [...config.get<IconRule[]>("rules", [])];
  const existing = rules.findIndex(
    (r) => r && typeof r.folderName === "string" && r.folderName.trim().toLowerCase() === folderName,
  );
  const rule: IconRule = { folderName, shape: shapePick.label as ShapeId, color };
  if (existing >= 0) {
    rules[existing] = rule;
  } else {
    rules.push(rule);
  }
  // Icon themes are window-global, so rules persist globally too — a
  // workspace-scoped rule would rewrite the shared theme on every window switch.
  await config.update("rules", rules, vscode.ConfigurationTarget.Global);
}

async function resetToDefaults(): Promise<void> {
  const pick = await vscode.window.showWarningMessage(
    "Reset Flutter Folder Lens to its default icons? This removes all custom rules.",
    { modal: true },
    "Reset",
  );
  if (pick !== "Reset") {
    return;
  }
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  for (const key of ["rules", "useDefaultRules", "baseIconTheme"]) {
    await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    if (vscode.workspace.workspaceFolders?.length) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
    }
  }
}

export function deactivate(): void {
  // nothing to clean up beyond context.subscriptions
}
