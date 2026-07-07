import { Minimatch } from "minimatch";

/**
 * A single decoration rule. `glob` is matched against workspace-relative
 * folder paths using `/` separators (e.g. `lib/screens`, `packages/app/lib/models`).
 */
export interface Rule {
  glob: string;
  badge: string;
  /** Theme color id, e.g. `flutterFolderLens.blue`. */
  color?: string;
}

/**
 * Built-in rules for common Flutter project conventions.
 * `**` matches zero or more path segments, so `lib/**\/screens` covers both
 * `lib/screens` and `lib/features/auth/screens`.
 */
export const DEFAULT_RULES: readonly Rule[] = [
  // lib/ layers — matched at any depth under lib/
  { glob: "**/lib/**/{screens,pages}", badge: "▢", color: "flutterFolderLens.blue" },
  { glob: "**/lib/**/widgets", badge: "▲", color: "flutterFolderLens.cyan" },
  { glob: "**/lib/**/models", badge: "◆", color: "flutterFolderLens.orange" },
  { glob: "**/lib/**/{providers,bloc,blocs,cubit,cubits,riverpod}", badge: "●", color: "flutterFolderLens.purple" },
  { glob: "**/lib/**/{services,repositories,data}", badge: "⬡", color: "flutterFolderLens.teal" },
  { glob: "**/lib/**/{utils,helpers,core}", badge: "✦", color: "flutterFolderLens.gray" },
  // tests
  { glob: "**/{test,test_driver,integration_test}", badge: "✓", color: "flutterFolderLens.green" },
  // assets
  { glob: "**/{assets,asset}", badge: "▣", color: "flutterFolderLens.yellow" },
  // platform folders — dimmed glyphs, top level of a package
  { glob: "**/android", badge: "🤖", color: "flutterFolderLens.dimmed" },
  { glob: "**/ios", badge: "🍎", color: "flutterFolderLens.dimmed" },
  { glob: "**/web", badge: "🌐", color: "flutterFolderLens.dimmed" },
  { glob: "**/macos", badge: "💻", color: "flutterFolderLens.dimmed" },
  { glob: "**/windows", badge: "🪟", color: "flutterFolderLens.dimmed" },
  { glob: "**/linux", badge: "🐧", color: "flutterFolderLens.dimmed" },
];

const DEFAULT_COLOR = "flutterFolderLens.blue";

/** Normalize a path for matching: forward slashes, no leading `./` or trailing `/`. */
export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

/** VS Code rejects badges longer than 2 characters (UTF-16 code units). */
export function clampBadge(badge: string): string {
  return badge.slice(0, 2);
}

interface CompiledRule {
  matcher: Minimatch;
  badge: string;
  color: string;
}

/**
 * Compiles rules once and resolves folder paths to decorations.
 * User rules are checked before defaults, so they win on overlap.
 */
export class RuleEngine {
  private readonly compiled: CompiledRule[] = [];

  constructor(userRules: readonly Rule[], useDefaults = true) {
    const rules = useDefaults ? [...userRules, ...DEFAULT_RULES] : [...userRules];
    for (const rule of rules) {
      if (!rule || typeof rule.glob !== "string" || typeof rule.badge !== "string" || !rule.badge) {
        continue; // tolerate malformed settings entries
      }
      // A bare folder path like `lib/screens` should also match when the
      // project is opened from a parent directory, so anchor-less globs get
      // an alternative `**/` prefix.
      const pattern = rule.glob.startsWith("**") ? rule.glob : `{${rule.glob},**/${rule.glob}}`;
      this.compiled.push({
        matcher: new Minimatch(pattern, { dot: false, nocase: false }),
        badge: clampBadge(rule.badge),
        color: typeof rule.color === "string" && rule.color ? rule.color : DEFAULT_COLOR,
      });
    }
  }

  /**
   * Returns the decoration for a workspace-relative folder path,
   * or undefined when no rule matches. First matching rule wins.
   */
  resolve(relativePath: string): { badge: string; color: string } | undefined {
    const path = normalizePath(relativePath);
    if (!path) {
      return undefined;
    }
    for (const rule of this.compiled) {
      if (rule.matcher.match(path)) {
        return { badge: rule.badge, color: rule.color };
      }
    }
    return undefined;
  }
}
