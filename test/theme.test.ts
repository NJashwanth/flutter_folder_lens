import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { SHAPE_IDS, renderShape } from "../src/shapes";
import { DEFAULT_ICON_RULES, PALETTE, generateTheme, mergeRules } from "../src/theme";

function parseTheme(rulesInput: unknown[] = [], useDefaults = true) {
  const files = generateTheme(mergeRules(rulesInput, useDefaults));
  return { theme: JSON.parse(files.themeJson), icons: files.icons };
}

describe("mergeRules", () => {
  it("includes every default rule", () => {
    const rules = mergeRules([], true);
    const names = rules.map((r) => r.folderName);
    for (const def of DEFAULT_ICON_RULES) {
      assert.ok(names.includes(def.folderName), def.folderName);
    }
  });

  it("lets user rules override defaults for the same folder name", () => {
    const rules = mergeRules([{ folderName: "screens", shape: "star", color: "red" }], true);
    const screens = rules.find((r) => r.folderName === "screens");
    assert.equal(screens?.shape, "star");
    assert.equal(screens?.colorKey, "red");
    // untouched defaults survive
    assert.equal(rules.find((r) => r.folderName === "widgets")?.shape, "triangle");
  });

  it("supports disabling defaults entirely", () => {
    const rules = mergeRules([{ folderName: "genkit", shape: "star", color: "red" }], false);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].folderName, "genkit");
  });

  it("accepts hex colors and normalizes folder names", () => {
    const rules = mergeRules([{ folderName: "  GenKit ", shape: "star", color: "#E53935" }], false);
    assert.equal(rules[0].folderName, "genkit");
    assert.deepEqual(rules[0].color, { dark: "#e53935", light: "#e53935" });
    assert.equal(rules[0].colorKey, "e53935");
  });

  it("skips malformed entries, unknown shapes, bad colors and 0.1.x badge rules", () => {
    const rules = mergeRules(
      [
        null,
        { glob: "lib/screens", badge: "▢", color: "flutterFolderLens.blue" },
        { folderName: "a", shape: "blob", color: "blue" },
        { folderName: "b", shape: "star", color: "not-a-color" },
        { folderName: "", shape: "star", color: "blue" },
        { folderName: "ok", shape: "star", color: "blue" },
      ],
      false,
    );
    assert.deepEqual(
      rules.map((r) => r.folderName),
      ["ok"],
    );
  });

  it("later user entries win over earlier ones", () => {
    const rules = mergeRules(
      [
        { folderName: "genkit", shape: "star", color: "red" },
        { folderName: "genkit", shape: "circle", color: "blue" },
      ],
      false,
    );
    assert.equal(rules.length, 1);
    assert.equal(rules[0].shape, "circle");
  });
});

describe("generateTheme (built-in base)", () => {
  const { theme, icons } = parseTheme();

  it("maps every default folder name to closed and expanded icon definitions", () => {
    for (const def of DEFAULT_ICON_RULES) {
      const closedId = theme.folderNames[def.folderName];
      const openId = theme.folderNamesExpanded[def.folderName];
      assert.ok(closedId, `folderNames missing ${def.folderName}`);
      assert.equal(openId, `${closedId}_open`);
      assert.ok(theme.iconDefinitions[closedId], `iconDefinitions missing ${closedId}`);
      assert.ok(theme.iconDefinitions[openId], `iconDefinitions missing ${openId}`);
    }
  });

  it("ships generic folder and file defaults so the theme is usable standalone", () => {
    assert.equal(theme.folder, "ffl_folder");
    assert.equal(theme.folderExpanded, "ffl_folder_open");
    assert.equal(theme.file, "ffl_file");
    assert.equal(theme.hidesExplorerArrows, false);
  });

  it("provides light-theme overrides for palette colors", () => {
    const lightId = theme.light.folderNames["screens"];
    assert.ok(lightId.endsWith("_lt"));
    const iconName = theme.iconDefinitions[lightId].iconPath.replace("./icons/", "");
    assert.ok(icons.get(iconName)?.includes(PALETTE.blue.light));
  });

  it("emits an SVG file for every icon definition it references", () => {
    for (const [id, def] of Object.entries<{ iconPath: string }>(theme.iconDefinitions)) {
      assert.ok(def.iconPath.startsWith("./icons/"), id);
      assert.ok(icons.has(def.iconPath.replace("./icons/", "")), `missing svg for ${id}`);
    }
  });

  it("bakes the rule color into the SVG and differentiates open variants", () => {
    const closed = icons.get("ffl_square_blue.svg");
    const open = icons.get("ffl_square_blue_open.svg");
    assert.ok(closed?.includes(PALETTE.blue.dark));
    assert.ok(open?.includes(PALETTE.blue.dark));
    assert.notEqual(closed, open);
  });

  it("is deterministic — identical input yields identical bytes", () => {
    const a = generateTheme(mergeRules([], true));
    const b = generateTheme(mergeRules([], true));
    assert.equal(a.themeJson, b.themeJson);
    assert.deepEqual([...a.icons.entries()], [...b.icons.entries()]);
  });

  it("adds custom rules (genkit → red star) with generated assets", () => {
    const { theme: t, icons: i } = parseTheme([{ folderName: "genkit", shape: "star", color: "red" }]);
    assert.equal(t.folderNames["genkit"], "ffl_star_red");
    assert.equal(t.folderNamesExpanded["genkit"], "ffl_star_red_open");
    assert.ok(i.get("ffl_star_red.svg")?.includes(PALETTE.red.dark));
  });

  it("custom hex colors get no light override (same fill both themes)", () => {
    const { theme: t } = parseTheme([{ folderName: "genkit", shape: "star", color: "#123456" }], false);
    assert.equal(t.folderNames["genkit"], "ffl_star_123456");
    assert.equal(t.light.folderNames["genkit"], undefined);
  });
});

describe("generateTheme (imported base theme)", () => {
  const base = {
    json: {
      iconDefinitions: {
        base_folder: { iconPath: "./icons/folder.svg" },
        base_file: { iconPath: "icons/file.svg" },
      },
      folder: "base_folder",
      file: "base_file",
      folderNames: { src: "base_folder", screens: "base_folder" },
      light: { folderNames: { src: "base_folder" } },
      fonts: [{ id: "f", src: [{ path: "./fonts/seti.woff", format: "woff" }] }],
    },
    pathPrefix: "../../other-ext/theme",
  };
  const files = generateTheme(mergeRules([], true), base);
  const theme = JSON.parse(files.themeJson);

  it("rewrites base icon paths relative to our theme directory", () => {
    assert.equal(theme.iconDefinitions.base_folder.iconPath, "../../other-ext/theme/icons/folder.svg");
    assert.equal(theme.iconDefinitions.base_file.iconPath, "../../other-ext/theme/icons/file.svg");
  });

  it("relocates base fonts into our theme dir and schedules the copy", () => {
    assert.equal(theme.fonts[0].src[0].path, "./fonts/0_seti.woff");
    assert.deepEqual(files.assets, [{ from: "fonts/seti.woff", to: "fonts/0_seti.woff" }]);
  });

  it("keeps the base theme's generic folder/file and unrelated mappings", () => {
    assert.equal(theme.folder, "base_folder");
    assert.equal(theme.file, "base_file");
    assert.equal(theme.folderNames.src, "base_folder");
    assert.equal(theme.light.folderNames.src, "base_folder");
  });

  it("overrides base mappings with Flutter rules and injects our definitions", () => {
    assert.equal(theme.folderNames.screens, "ffl_square_blue");
    assert.ok(theme.iconDefinitions.ffl_square_blue);
    assert.equal(theme.light.folderNames.screens, "ffl_square_blue_lt");
  });

  it("does not mutate the caller's base JSON", () => {
    assert.equal(base.json.iconDefinitions.base_folder.iconPath, "./icons/folder.svg");
  });
});

describe("renderShape", () => {
  it("renders every shape in both variants as valid 16px SVGs", () => {
    for (const shape of SHAPE_IDS) {
      for (const variant of ["closed", "open"] as const) {
        const svg = renderShape(shape, variant, "#112233");
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${shape}/${variant}`);
        assert.ok(svg.includes('viewBox="0 0 16 16"'), `${shape}/${variant}`);
        assert.ok(svg.includes("#112233"), `${shape}/${variant} missing fill`);
        assert.notEqual(renderShape(shape, "closed", "#112233"), renderShape(shape, "open", "#112233"));
      }
    }
  });
});
