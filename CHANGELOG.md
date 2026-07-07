# Change Log

## 0.1.0 — 2026-07-07

Initial release.

- Colored badges for common Flutter folder conventions (screens, widgets, models, state management, services, utils, tests, assets, platform folders), matched at any depth.
- Theme-aware contributed colors (`flutterFolderLens.*`) for light, dark and high-contrast themes.
- User rules via `flutterFolderLens.rules` (glob + badge + color), merging over — and winning against — the defaults; defaults can be disabled with `flutterFolderLens.useDefaultRules`.
- Commands: Assign Badge to Folder (Explorer context menu + palette), Refresh Decorations, Toggle On/Off.
- Activates only in workspaces whose `pubspec.yaml` declares Flutter.
