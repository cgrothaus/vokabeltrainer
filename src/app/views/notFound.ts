import { h } from "../dom";

export function notFoundView(): Node {
  return h(
    "main",
    null,
    h("h1", null, "Seite nicht gefunden"),
    h("p", null, h("a", { href: "#/" }, "Zur Bibliothek")),
  );
}
