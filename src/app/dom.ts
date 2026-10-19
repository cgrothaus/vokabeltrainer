// Kleiner DOM-Helfer (D-05). Strings werden immer als Textknoten eingefügt,
// Eigenschaften immer als Attribute gesetzt – Daten werden so nie als HTML interpretiert (TAK-03).

export type Child = Node | string | number | false | null | undefined | Child[];

export type Props = Record<string, string | number | boolean | EventListener | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (typeof value === "function") {
      if (!key.startsWith("on"))
        throw new Error(`Ereignis-Eigenschaft muss mit "on" beginnen: ${key}`);
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else if (value !== false && value != null) {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else if (typeof child === "string" || typeof child === "number")
      parent.appendChild(document.createTextNode(String(child)));
  }
}
