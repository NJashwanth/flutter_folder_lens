# Change Log

## 0.2.0 — 2026-07-07

**Breaking: badges → real folder icons.** The extension is now a Flutter-aware file icon theme instead of a badge decorator.

- Contributes the **Flutter Folder Lens** file icon theme: colored, shape-based folder icons (closed + expanded variants, dark/light fills) for screens/pages, widgets, models, state management, services/data, utils, tests, assets, platform folders and generated code.
- Icons and theme JSON are regenerated at runtime from your configuration; generation is idempotent and prompts for a window reload only when something actually changed.
- New `flutterFolderLens.rules` schema: `{folderName, shape, color}` with a built-in shape library and palette-or-hex colors. Old `{glob, badge, color}` entries are ignored.
- New `flutterFolderLens.baseIconTheme` setting to layer the Flutter icons on top of another installed icon theme (`"auto"` imports your previous theme).
- New commands: **Set Icon for Folder…**, **Regenerate Icons**, **Reset to Defaults**. Removed: Assign Badge to Folder, Refresh Decorations, Toggle On/Off.
- Removed the `FileDecorationProvider` badges, the `flutterFolderLens.enabled` setting and the contributed `flutterFolderLens.*` theme colors.
- Matching is now by folder **name** (`models`), not path (`lib/models`) — a limitation of VS Code icon themes. The theme must be selected as your file icon theme to take effect.

## 0.1.1 — 2026-07-07

- Added extension icon.

## 0.1.0 — 2026-07-07

Initial release.

- Colored badges for common Flutter folder conventions (screens, widgets, models, state management, services, utils, tests, assets, platform folders), matched at any depth.
- Theme-aware contributed colors (`flutterFolderLens.*`) for light, dark and high-contrast themes.
- User rules via `flutterFolderLens.rules` (glob + badge + color), merging over — and winning against — the defaults; defaults can be disabled with `flutterFolderLens.useDefaultRules`.
- Commands: Assign Badge to Folder (Explorer context menu + palette), Refresh Decorations, Toggle On/Off.
- Activates only in workspaces whose `pubspec.yaml` declares Flutter.
