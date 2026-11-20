// Symbole als Inline-SVG (TDD 13.7, D-45): eigene Zeichnungen auf einem Raster von 24 × 24, ohne
// Abhängigkeit und ohne `innerHTML` (TAK-03). Sie sind Schmuck; Text oder `aria-label` trägt der Knopf.

const SVG = "http://www.w3.org/2000/svg";

type Shape = [tag: "path" | "circle", attributes: Record<string, string>];

const ICONS = {
  back: [["path", { d: "M15 5l-7 7 7 7" }]],
  close: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  gear: [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    [
      "path",
      {
        d: "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
      },
    ],
  ],
  play: [["path", { d: "M7 4.5v15l12-7.5z", class: "fill" }]],
  more: [
    ["circle", { cx: "5", cy: "12", r: "1.3" }],
    ["circle", { cx: "12", cy: "12", r: "1.3" }],
    ["circle", { cx: "19", cy: "12", r: "1.3" }],
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  sort: [["path", { d: "M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" }]],
  grip: [
    ["circle", { cx: "9", cy: "6", r: "1.4", class: "fill" }],
    ["circle", { cx: "15", cy: "6", r: "1.4", class: "fill" }],
    ["circle", { cx: "9", cy: "12", r: "1.4", class: "fill" }],
    ["circle", { cx: "15", cy: "12", r: "1.4", class: "fill" }],
    ["circle", { cx: "9", cy: "18", r: "1.4", class: "fill" }],
    ["circle", { cx: "15", cy: "18", r: "1.4", class: "fill" }],
  ],
  up: [["path", { d: "M12 19V5M6 11l6-6 6 6" }]],
  down: [["path", { d: "M12 5v14M6 13l6 6 6-6" }]],
  move: [["path", { d: "M3 7h7l2 2h9v10H3zM10 14h6M14 12l2 2-2 2" }]],
  info: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M12 11v6M12 7.5h.01" }],
  ],
  chevron: [["path", { d: "M9 6l6 6-6 6" }]],
  help: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17h.01" }],
  ],
  shield: [["path", { d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" }]],
  edit: [["path", { d: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" }]],
  download: [["path", { d: "M12 4v11M8 11l4 4 4-4M5 19h14" }]],
  trash: [["path", { d: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" }]],
  phone: [
    [
      "path",
      {
        d: "M9.5 2.5h5A2.5 2.5 0 0 1 17 5v14a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19V5a2.5 2.5 0 0 1 2.5-2.5z",
      },
    ],
    ["path", { d: "M11 18.5h2" }],
  ],
  share: [["path", { d: "M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" }]],
  home: [
    [
      "path",
      { d: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zM12 8v8M8 12h8" },
    ],
  ],
  cloud: [
    [
      "path",
      {
        d: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18zM12 11v5M9.5 13.5L12 11l2.5 2.5",
      },
    ],
  ],
  restore: [["path", { d: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" }]],
  file: [["path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" }]],
  clipboard: [
    [
      "path",
      {
        d: "M8 4h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4.5V3h6v1.5M9 11h6M9 15h4",
      },
    ],
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attributes] of ICONS[name] as Shape[]) {
    const shape = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value);
    svg.appendChild(shape);
  }
  return svg;
}
