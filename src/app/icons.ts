// Symbole als Inline-SVG (TDD 13.7, D-45): eigene Zeichnungen auf einem Raster von 24 × 24, ohne
// Abhängigkeit und ohne `innerHTML` (TAK-03). Sie sind Schmuck; Text oder `aria-label` trägt der Knopf.

const SVG = "http://www.w3.org/2000/svg";

type Shape = [tag: "path" | "circle", attributes: Record<string, string>];

const ICONS = {
  back: [["path", { d: "M15 5l-7 7 7 7" }]],
  close: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
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
