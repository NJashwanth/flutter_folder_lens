# Marketplace media

- `icon.png` — extension icon (256×256), rendered from `icon.svg`. Regenerate with:
  `python3 -c "import cairosvg; cairosvg.svg2png(url='images/icon.svg', write_to='images/icon.png', output_width=256, output_height=256)"`
- `explorer.png` — screenshot of the sample workspace in the Explorer with the default folder icons active (referenced from the main README; excluded from the vsix — the Marketplace loads it from GitHub).
