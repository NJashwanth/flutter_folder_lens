# Flutter Folder Lens

**Make your Flutter project structure instantly scannable.** Flutter Folder Lens decorates folders in the Explorer with colored badges based on their role — screens, widgets, models, state management, services, tests, assets and platform folders each get their own glyph and color.

<!-- TODO: replace with a real capture before publishing -->
![Flutter Folder Lens in action](images/demo.gif)

## Why

Large Flutter apps — especially feature-first layouts and monorepos — repeat the same folder names (`screens`, `widgets`, `models`, `bloc`, …) dozens of times. Folder Lens turns those conventions into visual anchors so you can navigate the Explorer at a glance.

> VS Code's decoration API supports a **badge (up to 2 characters) and a theme color** per item. Actual folder-icon recoloring is not exposed to extensions, so Folder Lens gives you the closest thing that works everywhere: crisp, theme-aware badges.

## Default decorations

| Folder (anywhere under `lib/`) | Badge | Color |
| --- | :---: | --- |
| `screens`, `pages` | ▢ | blue |
| `widgets` | ▲ | cyan |
| `models` | ◆ | orange |
| `providers`, `bloc`, `cubit`, `riverpod` | ● | purple |
| `services`, `repositories`, `data` | ⬡ | teal |
| `utils`, `helpers`, `core` | ✦ | gray |

| Folder (project level) | Badge | Color |
| --- | :---: | --- |
| `test`, `test_driver`, `integration_test` | ✓ | green |
| `assets` | ▣ | yellow |
| `android` / `ios` / `web` / `macos` / `windows` / `linux` | 🤖 🍎 🌐 💻 🪟 🐧 | dimmed |

Nested matches work everywhere: `lib/features/auth/screens` and `packages/my_app/lib/models` are decorated just like their top-level counterparts.

All colors are [contributed theme colors](https://code.visualstudio.com/api/references/theme-color), so they adapt to light, dark and high-contrast themes — and you can override any of them in `workbench.colorCustomizations` (e.g. `flutterFolderLens.blue`).

## Zero overhead outside Flutter

The extension activates only when the workspace contains a `pubspec.yaml` that declares a `flutter` dependency (or a `flutter:` section). No pubspec, no Flutter → nothing runs. There is no polling and no file watching; decorations are resolved on demand by VS Code, so it stays instant even in large monorepos.

## Custom rules

Right-click any folder → **Flutter Folder Lens: Assign Badge to Folder**, pick a badge and a color, and the rule is saved to your workspace settings. Or edit settings directly:

```jsonc
"flutterFolderLens.rules": [
  { "glob": "lib/features/*/ui", "badge": "U", "color": "flutterFolderLens.cyan" },
  { "glob": "lib/l10n",          "badge": "🌍", "color": "flutterFolderLens.green" },
  // your rules always win over the built-in defaults
  { "glob": "lib/screens",       "badge": "S",  "color": "charts.red" }
]
```

- `glob` is matched against the workspace-relative folder path (`lib/**/screens`, `packages/*/test`, …).
- `badge` is at most 2 characters (a VS Code limit).
- `color` is any theme color id — the bundled `flutterFolderLens.*` palette or built-ins like `charts.red`.

Want a fully custom scheme? Set `"flutterFolderLens.useDefaultRules": false` and only your rules apply.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `flutterFolderLens.enabled` | `true` | Master switch for all decorations. |
| `flutterFolderLens.useDefaultRules` | `true` | Apply the built-in Flutter conventions. |
| `flutterFolderLens.rules` | `[]` | Your rules; merged over (and winning against) the defaults. |

## Commands

| Command | What it does |
| --- | --- |
| **Flutter Folder Lens: Assign Badge to Folder** | Quick-pick a badge + color for a folder; persists to workspace settings. Also in the Explorer context menu. |
| **Flutter Folder Lens: Refresh Decorations** | Re-reads settings and re-decorates. |
| **Flutter Folder Lens: Toggle On/Off** | Flips `flutterFolderLens.enabled`. |

Decorations also refresh automatically when settings or workspace folders change.

## Notes & limitations

- Badges share the decoration slot with other providers (Git, problems). VS Code merges them; when the slot is contested the badge may not always be yours.
- Folder icons themselves cannot be recolored by extensions — badges + label color are the supported surface.

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
