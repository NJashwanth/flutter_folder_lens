/**
 * Detects whether a pubspec.yaml belongs to a Flutter project: either a
 * `flutter` entry under `dependencies`/`dev_dependencies` or a top-level
 * `flutter:` section. Line-based scan — no YAML parser needed.
 */
export function isFlutterPubspec(content: string): boolean {
  const lines = content.split(/\r?\n/);
  let inDependencies = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "");
    if (!line.trim()) {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      if (/^flutter\s*:/.test(line)) {
        return true; // top-level flutter: section (assets, fonts, plugin, ...)
      }
      inDependencies = /^(dependencies|dev_dependencies)\s*:/.test(line);
      continue;
    }
    if (inDependencies && /^flutter\s*:/.test(line.trim())) {
      return true;
    }
  }
  return false;
}
