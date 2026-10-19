import { h } from "../dom";

export function libraryView(): Node {
  return h(
    "main",
    null,
    h("h1", null, "Vokabeltrainer"),
    h("p", null, "Noch keine Vokabelsets vorhanden."),
  );
}
