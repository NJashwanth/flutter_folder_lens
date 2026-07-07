import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_RULES, RuleEngine, clampBadge, normalizePath } from "../src/rules";
import { isFlutterPubspec } from "../src/pubspec";

describe("RuleEngine defaults", () => {
  const engine = new RuleEngine([], true);

  it("decorates lib/screens and lib/pages as blue ▢", () => {
    assert.deepEqual(engine.resolve("lib/screens"), { badge: "▢", color: "flutterFolderLens.blue" });
    assert.deepEqual(engine.resolve("lib/pages"), { badge: "▢", color: "flutterFolderLens.blue" });
  });

  it("matches nested folders anywhere under lib/", () => {
    assert.equal(engine.resolve("lib/features/auth/screens")?.badge, "▢");
    assert.equal(engine.resolve("lib/features/cart/widgets")?.badge, "▲");
    assert.equal(engine.resolve("lib/src/deeply/nested/models")?.badge, "◆");
  });

  it("decorates state-management folders as purple ●", () => {
    for (const name of ["providers", "bloc", "cubit", "riverpod"]) {
      assert.deepEqual(engine.resolve(`lib/${name}`), {
        badge: "●",
        color: "flutterFolderLens.purple",
      });
    }
  });

  it("decorates services/repositories/data as teal ⬡", () => {
    assert.equal(engine.resolve("lib/services")?.color, "flutterFolderLens.teal");
    assert.equal(engine.resolve("lib/features/orders/repositories")?.badge, "⬡");
    assert.equal(engine.resolve("lib/data")?.badge, "⬡");
  });

  it("decorates utils/helpers/core as gray ✦", () => {
    assert.equal(engine.resolve("lib/utils")?.badge, "✦");
    assert.equal(engine.resolve("lib/core")?.color, "flutterFolderLens.gray");
  });

  it("decorates test folders as green ✓", () => {
    assert.deepEqual(engine.resolve("test"), { badge: "✓", color: "flutterFolderLens.green" });
    assert.equal(engine.resolve("integration_test")?.badge, "✓");
  });

  it("decorates assets as yellow ▣", () => {
    assert.deepEqual(engine.resolve("assets"), { badge: "▣", color: "flutterFolderLens.yellow" });
  });

  it("dims platform folders", () => {
    for (const name of ["android", "ios", "web", "macos", "windows", "linux"]) {
      assert.equal(engine.resolve(name)?.color, "flutterFolderLens.dimmed", name);
    }
  });

  it("works in monorepos where the package is not at the workspace root", () => {
    assert.equal(engine.resolve("packages/my_app/lib/screens")?.badge, "▢");
    assert.equal(engine.resolve("apps/mobile/test")?.badge, "✓");
    assert.equal(engine.resolve("packages/my_app/android")?.color, "flutterFolderLens.dimmed");
  });

  it("does not decorate unrelated folders or files inside matched folders", () => {
    assert.equal(engine.resolve("lib"), undefined);
    assert.equal(engine.resolve("lib/foo"), undefined);
    assert.equal(engine.resolve("lib/screens/home_screen.dart"), undefined);
    assert.equal(engine.resolve("screens"), undefined, "screens must live under lib/");
    assert.equal(engine.resolve(""), undefined);
  });

  it("keeps every default badge within the 2-character limit", () => {
    for (const rule of DEFAULT_RULES) {
      assert.ok(rule.badge.length <= 2, `badge ${rule.badge} for ${rule.glob}`);
    }
  });
});

describe("RuleEngine user rules", () => {
  it("lets user rules override defaults for the same path", () => {
    const engine = new RuleEngine([{ glob: "lib/screens", badge: "S", color: "charts.red" }], true);
    assert.deepEqual(engine.resolve("lib/screens"), { badge: "S", color: "charts.red" });
    // other defaults still apply
    assert.equal(engine.resolve("lib/widgets")?.badge, "▲");
  });

  it("supports disabling defaults entirely", () => {
    const engine = new RuleEngine([{ glob: "lib/screens", badge: "S" }], false);
    assert.equal(engine.resolve("lib/widgets"), undefined);
    assert.equal(engine.resolve("test"), undefined);
    assert.equal(engine.resolve("lib/screens")?.badge, "S");
  });

  it("matches plain folder paths and globs, including under nested roots", () => {
    const engine = new RuleEngine(
      [
        { glob: "lib/features/*/ui", badge: "U", color: "flutterFolderLens.cyan" },
        { glob: "docs", badge: "D" },
      ],
      false,
    );
    assert.equal(engine.resolve("lib/features/auth/ui")?.badge, "U");
    assert.equal(engine.resolve("lib/features/ui"), undefined);
    assert.equal(engine.resolve("docs")?.badge, "D");
    assert.equal(engine.resolve("packages/app/docs")?.badge, "D");
  });

  it("falls back to the default color when a rule omits it", () => {
    const engine = new RuleEngine([{ glob: "docs", badge: "D" }], false);
    assert.equal(engine.resolve("docs")?.color, "flutterFolderLens.blue");
  });

  it("ignores malformed rules from settings", () => {
    const engine = new RuleEngine(
      [
        null as unknown as { glob: string; badge: string },
        { glob: "docs" } as { glob: string; badge: string },
        { glob: 42, badge: "X" } as unknown as { glob: string; badge: string },
        { glob: "ok", badge: "K" },
      ],
      false,
    );
    assert.equal(engine.resolve("ok")?.badge, "K");
    assert.equal(engine.resolve("docs"), undefined);
  });

  it("clamps badges to two characters", () => {
    const engine = new RuleEngine([{ glob: "docs", badge: "LONG" }], false);
    assert.equal(engine.resolve("docs")?.badge, "LO");
    assert.equal(clampBadge("🤖x"), "🤖");
  });
});

describe("normalizePath", () => {
  it("normalizes separators and trims slashes", () => {
    assert.equal(normalizePath("lib\\screens\\"), "lib/screens");
    assert.equal(normalizePath("./lib/screens/"), "lib/screens");
    assert.equal(normalizePath("/Users/me/app"), "Users/me/app");
  });
});

describe("isFlutterPubspec", () => {
  it("detects a flutter sdk dependency", () => {
    assert.ok(
      isFlutterPubspec(
        ["name: my_app", "dependencies:", "  flutter:", "    sdk: flutter", "  http: ^1.0.0"].join("\n"),
      ),
    );
  });

  it("detects a top-level flutter: section", () => {
    assert.ok(isFlutterPubspec(["name: my_app", "flutter:", "  uses-material-design: true"].join("\n")));
  });

  it("rejects pure Dart packages", () => {
    assert.equal(
      isFlutterPubspec(["name: my_lib", "dependencies:", "  http: ^1.0.0", "  path: ^1.9.0"].join("\n")),
      false,
    );
  });

  it("is not fooled by flutter mentions in comments or other packages", () => {
    assert.equal(
      isFlutterPubspec(
        ["name: my_lib", "# flutter: not really", "dependencies:", "  flutter_lints_like: ^1.0.0"].join("\n"),
      ),
      false,
    );
  });
});
