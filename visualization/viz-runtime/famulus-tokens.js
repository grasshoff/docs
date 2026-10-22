// generated from tokens/famulus.json by famulus_visualization.tokens — do not edit
export const tokens = {
  "id": "famulus-visualization",
  "version": "0.1.0",
  "extends": "LWgrammar/guides/design/d3-bauhaus/tokens.json (lettreai-bauhaus 1.0.0, FWG1-F3)",
  "sources": {
    "core": "LWgrammar/guides/design/d3-bauhaus/tokens.json",
    "categorical": "publication/rundbriefe/famulus-news/shared/news.css (--p-*, --a-* member and pillar accents)",
    "surfaces": "scholarly/projects/landings2026/build/shared/landing.css"
  },
  "color": {
    "oxford": "#002147",
    "oxford_deep": "#00152e",
    "oxford_700": "#042b5b",
    "oxford_300": "#2c5282",
    "oxford_100": "#dbe3ee",
    "gold": "#cfb53b",
    "gold_deep": "#8c6d2a",
    "gold_100": "#f3ead0",
    "paper": "#fafaf5",
    "sandstone": "#fbf8f2",
    "sandstone_dark": "#efe9db",
    "line": "#cdbfa4",
    "ink": "#1a1a1a",
    "muted": "#5c5348",
    "white": "#ffffff"
  },
  "dark": {
    "paper": "#0d1624",
    "surface": "#152238",
    "ink": "#ece6d8",
    "muted": "#a89f90",
    "line": "#3a4a63",
    "oxford": "#8fb0dc",
    "oxford_700": "#b9cde8",
    "oxford_300": "#6d93c7",
    "oxford_100": "#22324d",
    "gold": "#d9c25e",
    "gold_deep": "#c4a15a",
    "gold_100": "#3b3420",
    "sandstone": "#152238"
  },
  "ramp": {
    "categorical": [
      "#002147",
      "#8c6d2a",
      "#3f7686",
      "#9a4f3c",
      "#5f6b3a",
      "#7a4a6a",
      "#5c5348"
    ],
    "categorical_dark": [
      "#8fb0dc",
      "#d9c25e",
      "#7fb3c2",
      "#d0907c",
      "#a9b67a",
      "#c193b3",
      "#a89f90"
    ],
    "sequential": [
      "#f3f6fa",
      "#dbe3ee",
      "#a9bcd6",
      "#6f8fb8",
      "#2c5282",
      "#042b5b",
      "#002147"
    ],
    "diverging": [
      "#002147",
      "#2c5282",
      "#a9bcd6",
      "#fafaf5",
      "#e6d6a8",
      "#b8953f",
      "#8c6d2a"
    ],
    "highlight": "#cfb53b",
    "context": "#cdbfa4"
  },
  "font": {
    "family": [
      "Source Sans 3",
      "Inter",
      "Helvetica Neue",
      "Arial"
    ],
    "serif": [
      "Source Serif 4",
      "Palatino Linotype",
      "Palatino",
      "Georgia"
    ],
    "mono": [
      "Fira Code",
      "JetBrains Mono",
      "Menlo"
    ],
    "size": {
      "small": 8,
      "tick": 8.5,
      "label": 9.5,
      "caption": 9,
      "title": 11
    },
    "size_px": {
      "small": 11,
      "tick": 12,
      "label": 13,
      "caption": 12,
      "title": 15
    },
    "weight": {
      "regular": 400,
      "bold": 600
    }
  },
  "stroke": {
    "hairline": 0.5,
    "grid": 0.4,
    "line": 1.2,
    "edge": 1.5,
    "accent": 2.4
  },
  "stroke_px": {
    "hairline": 1,
    "grid": 0.75,
    "line": 1.5,
    "edge": 2,
    "accent": 3
  },
  "mark": {
    "size": 3.2,
    "size_px": 5
  },
  "motion": {
    "step_ms": 1200,
    "dwell_ms": 1800,
    "ease": "cubic-in-out",
    "rule": "slow enough to follow every change; one change per step (sundial3d learned preference)"
  },
  "rules": [
    "flat fills; no gradients, shadows or 3-D effects on 2-D charts",
    "one visual channel per variable",
    "semantic red/green are excluded from house documents",
    "the highlight colour marks the claim of the narrative; everything else is context",
    "axes start at zero for bars; log scales are labelled as such",
    "uncertainty is shown wherever the data carry it (CI bands or error bars)",
    "sans-serif labels; no italics in diagram labels"
  ]
};

// ?theme=light|dark forces a theme (checks and screenshots); otherwise the reader's setting holds
const forced = new URLSearchParams(location.search).get('theme');
if (forced === 'light' || forced === 'dark') document.documentElement.dataset.theme = forced;

export const isDark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' &&
   window.matchMedia('(prefers-color-scheme: dark)').matches);

export const color = (key) => (isDark() && key in tokens.dark ? tokens.dark[key] : tokens.color[key]);
export const categorical = () => (isDark() ? tokens.ramp.categorical_dark : tokens.ramp.categorical);
