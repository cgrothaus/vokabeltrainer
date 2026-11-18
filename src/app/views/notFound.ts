import { frame } from "../components/frame";
import { h } from "../dom";

export function notFoundView(): Node {
  return frame(
    { title: "Seite nicht gefunden", back: { parent: "#/" } },
    h("main", null, h("p", null, h("a", { href: "#/" }, "Zur Bibliothek"))),
  ).element;
}
