# DM Blog Studio

Internal DesignMonks tool for making blog covers. Drop in a hero render, type the title, and export three formats at 2x, plus an HTML file you can bring into Figma:

| Format    | Size        | File suffix  |
|-----------|-------------|--------------|
| Blog hero | 1252 × 438  | `-wide.png`  |
| Thumbnail | 610 × 350   | `-thumb.png` |
| Story     | 1080 × 1920 | `-story.png` |

## Using it

It is a static site with no build step and no server code.

- **Locally:** open `index.html` in Chrome, Edge or Safari. Double-clicking works; you don't need a server.
- **Hosted:** turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root). The `.nojekyll` file makes Pages serve the files as they are.

What it does:

1. **Hero image.** Drop, paste or pick a transparent PNG. Transparent margins are trimmed automatically, and you get a warning if the image has no transparency or is under 1600px wide.
2. **Title.** Pick the italic words (Playfair Display Italic) with the studio rule (Auto) or by clicking words (Manual). You can also wrap words in `*asterisks*`. Press Enter to force a line break.
3. **Colours.** The background and shade colours are sampled from the hero and kept at 4.5:1 contrast or better against the white title.
4. **Adjust.** Drag the hero on any preview, and use the hero and title size sliders for each format.
5. **Export.** Download single PNGs, or **Download all (.zip)** to get all three PNGs plus `<slug>-figma.html`.

## Project layout

```
index.html                 Page markup
css/
  fonts.css                @font-face rules for the self-hosted fonts
  styles.css               UI styles
js/
  app.js                   App logic: layout, rendering, colour sampling, export
  embedded-assets.js       GENERATED. Base64 copies of the sample hero and two export fonts
  vendor/jszip.min.js      JSZip 3.10.1 (MIT), used to build the zip
assets/
  fonts/                   Red Hat Display 400/500/600/700, Playfair Display Italic 700 (woff2)
  images/sample-hero.png   Sample hero that loads on start
tools/
  build-embedded.py        Rebuilds js/embedded-assets.js from assets/
```

### Why `embedded-assets.js` exists

Browsers block two things when a page is opened from disk (`file://`): reading pixels from a canvas that drew a local image, and `fetch()` of local files. The studio needs both, to sample colours from the sample hero and to embed the fonts in the exported Figma HTML. Keeping base64 copies in one generated file means the tool works when you double-click it and when it's hosted.

If you replace `assets/images/sample-hero.png`, `assets/fonts/red-hat-display-700.woff2` or `assets/fonts/playfair-display-italic-700.woff2`, regenerate the file:

```sh
python3 tools/build-embedded.py
```

## Template values

The frame sizes, text zones, shade gradients and strip positions come from the DesignMonks Figma source. They are in the `F` object at the top of `js/app.js`. Change them there if the template changes.

## Claude features

Inside a Claude artifact, the **Ask Claude** button picks the italic phrase and downloads go through Claude's download prompt. Outside Claude (locally or on GitHub Pages), the button is hidden, the studio rule picks the phrase, and files download normally.
