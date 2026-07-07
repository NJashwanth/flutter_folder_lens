import * as vscode from "vscode";
import { Rule, RuleEngine, clampBadge, normalizePath } from "./rules";
import { isFlutterPubspec } from "./pubspec";

const CONFIG_SECTION = "flutterFolderLens";

/** Badge presets offered by the "Assign Badge to Folder" command. */
const BADGE_PRESETS = ["▢", "▲", "◆", "●", "⬡", "✦", "✓", "▣", "★", "♥", "⚑", "◈"];

const COLOR_PRESETS: Array<{ label: string; id: string }> = [
  { label: "Blue", id: "flutterFolderLens.blue" },
  { label: "Cyan", id: "flutterFolderLens.cyan" },
  { label: "Orange", id: "flutterFolderLens.orange" },
  { label: "Purple", id: "flutterFolderLens.purple" },
  { label: "Teal", id: "flutterFolderLens.teal" },
  { label: "Gray", id: "flutterFolderLens.gray" },
  { label: "Green", id: "flutterFolderLens.green" },
  { label: "Yellow", id: "flutterFolderLens.yellow" },
  { label: "Dimmed", id: "flutterFolderLens.dimmed" },
];

class FolderLensProvider implements vscode.FileDecorationProvider {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.changeEmitter.event;

  private engine = new RuleEngine([]);
  private enabled = true;
  /** fsPaths of workspace folders whose pubspec.yaml declares Flutter. */
  private flutterRoots: string[] = [];

  reload(): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    this.enabled = config.get<boolean>("enabled", true);
    const userRules = config.get<Rule[]>("rules", []);
    const useDefaults = config.get<boolean>("useDefaultRules", true);
    this.engine = new RuleEngine(userRules, useDefaults);
  }

  setFlutterRoots(roots: string[]): void {
    this.flutterRoots = roots;
  }

  get hasFlutterRoots(): boolean {
    return this.flutterRoots.length > 0;
  }

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (!this.enabled || uri.scheme !== "file") {
      return undefined;
    }
    const relative = this.toFlutterRelativePath(uri.fsPath);
    if (relative === undefined) {
      return undefined;
    }
    const match = this.engine.resolve(relative);
    if (!match) {
      return undefined;
    }
    // Rules describe folders; skip the rare file that shares a folder-like
    // path. The stat only runs for matched paths, so it stays cheap.
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if ((stat.type & vscode.FileType.Directory) === 0) {
        return undefined;
      }
    } catch {
      return undefined;
    }
    return {
      badge: match.badge,
      color: new vscode.ThemeColor(match.color),
      tooltip: "Flutter Folder Lens",
      propagate: false,
    };
  }

  private toFlutterRelativePath(fsPath: string): string | undefined {
    const path = normalizePath(fsPath);
    for (const root of this.flutterRoots) {
      if (path.startsWith(root + "/")) {
        return path.slice(root.length + 1);
      }
    }
    return undefined;
  }
}

async function detectFlutterRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (folder.uri.scheme !== "file") {
      continue;
    }
    try {
      const pubspec = vscode.Uri.joinPath(folder.uri, "pubspec.yaml");
      const bytes = await vscode.workspace.fs.readFile(pubspec);
      if (isFlutterPubspec(new TextDecoder().decode(bytes))) {
        roots.push(normalizePath(folder.uri.fsPath));
      }
    } catch {
      // no pubspec.yaml in this folder
    }
  }
  return roots;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const provider = new FolderLensProvider();
  provider.reload();
  provider.setFlutterRoots(await detectFlutterRoots());
  context.subscriptions.push(provider);

  // Only pay for the decoration provider in actual Flutter workspaces; a
  // pure-Dart pubspec.yaml activates us but registers nothing beyond commands.
  let providerRegistration: vscode.Disposable | undefined;
  const syncRegistration = () => {
    if (provider.hasFlutterRoots && !providerRegistration) {
      providerRegistration = vscode.window.registerFileDecorationProvider(provider);
      context.subscriptions.push(providerRegistration);
    }
  };
  syncRegistration();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        provider.reload();
        provider.refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      provider.setFlutterRoots(await detectFlutterRoots());
      syncRegistration();
      provider.refresh();
    }),
    vscode.commands.registerCommand("flutterFolderLens.refresh", async () => {
      provider.setFlutterRoots(await detectFlutterRoots());
      syncRegistration();
      provider.reload();
      provider.refresh();
    }),
    vscode.commands.registerCommand("flutterFolderLens.toggle", async () => {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const enabled = config.get<boolean>("enabled", true);
      const target = vscode.workspace.workspaceFolders?.length
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await config.update("enabled", !enabled, target);
      vscode.window.setStatusBarMessage(
        `Flutter Folder Lens: ${enabled ? "off" : "on"}`,
        3000,
      );
    }),
    vscode.commands.registerCommand("flutterFolderLens.assignBadge", (uri?: vscode.Uri) =>
      assignBadge(uri),
    ),
  );
}

async function assignBadge(uri?: vscode.Uri): Promise<void> {
  const glob = await resolveGlobForTarget(uri);
  if (!glob) {
    return;
  }

  const badgePick = await vscode.window.showQuickPick(
    [
      ...BADGE_PRESETS.map((b) => ({ label: b, description: "" })),
      { label: "Custom…", description: "Type your own badge (max 2 characters)" },
    ],
    { placeHolder: `Badge for "${glob}"` },
  );
  if (!badgePick) {
    return;
  }
  let badge = badgePick.label;
  if (badge === "Custom…") {
    const input = await vscode.window.showInputBox({
      prompt: "Badge text (max 2 characters)",
      validateInput: (v) => (v.trim() ? undefined : "Badge cannot be empty"),
    });
    if (!input) {
      return;
    }
    badge = clampBadge(input.trim());
  }

  const colorPick = await vscode.window.showQuickPick(
    [
      ...COLOR_PRESETS.map((c) => ({ label: c.label, description: c.id })),
      { label: "Other theme color…", description: "Any theme color id, e.g. charts.red" },
    ],
    { placeHolder: "Badge color" },
  );
  if (!colorPick) {
    return;
  }
  let color = colorPick.description ?? "";
  if (colorPick.label === "Other theme color…") {
    const input = await vscode.window.showInputBox({
      prompt: "Theme color id",
      value: "charts.red",
    });
    if (!input) {
      return;
    }
    color = input.trim();
  }

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rules = [...config.get<Rule[]>("rules", [])];
  const existing = rules.findIndex((r) => r?.glob === glob);
  const rule: Rule = { glob, badge, color };
  if (existing >= 0) {
    rules[existing] = rule;
  } else {
    rules.push(rule);
  }
  const target = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("rules", rules, target);
  vscode.window.setStatusBarMessage(`Flutter Folder Lens: ${badge} assigned to ${glob}`, 3000);
}

async function resolveGlobForTarget(uri?: vscode.Uri): Promise<string | undefined> {
  if (uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      void vscode.window.showWarningMessage("Folder is outside the current workspace.");
      return undefined;
    }
    const root = normalizePath(folder.uri.fsPath);
    const target = normalizePath(uri.fsPath);
    if (target === root) {
      void vscode.window.showWarningMessage("Pick a folder inside the workspace root.");
      return undefined;
    }
    return target.slice(root.length + 1);
  }
  // Invoked from the command palette: ask for the glob directly.
  return vscode.window.showInputBox({
    prompt: "Folder path or glob to decorate (workspace-relative)",
    placeHolder: "lib/features/**/screens",
    validateInput: (v) => (v.trim() ? undefined : "Enter a folder path or glob"),
  });
}

export function deactivate(): void {
  // nothing to clean up beyond context.subscriptions
}
