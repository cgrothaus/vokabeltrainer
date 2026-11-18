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
  chevron: [["path", { d: "M9 6l6 6-6 6" }]],
  help: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17h.01" }],
  ],
  shield: [["path", { d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" }]],
  edit: [["path", { d: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" }]],
  download: [["path", { d: "M12 4v11M8 11l4 4 4-4M5 19h14" }]],
  trash: [["path", { d: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" }]],
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
