// Lernstand als kurze Zeile mit Balken (TDD 12.6, 12.7, 13.7): in der Bibliothek je Set, in der
// Set-Ansicht je Sektion und je Richtung. Balken sind Schmuck; das Gezeigte steht immer auch als Text
// daneben oder für Screenreader (13.4).
import {
  type CardState,
  phaseCounts,
  type Stage,
  type StageCounts,
} from "../../domain/learningState";
import type { StoredSet } from "../../domain/model";
import { describeDay, type Overview } from "../../domain/stats";
import { type Child, h } from "../dom";
import { languageName } from "../languages";

/** Balken für eine Quote in Prozent. */
export function track(percent: number): HTMLElement {
  const fill = h("span", null);
  fill.style.width = `${percent}%`;
  return h("span", { class: "track", "aria-hidden": "true" }, fill);
}

/** Lernstand einer Richtung: „Englisch → Deutsch“ mit Anzahl je Stufe. */
export interface DirectionStages {
  /** Sichtbar, mit Pfeil. */
  label: string;
  /** Vorgelesen: „Englisch nach Deutsch“. */
  spoken: string;
  counts: StageCounts;
}

/** Beide Richtungen, Lernsprache → Muttersprache zuerst (TDD 12.7). */
export function directionStages(
  set: StoredSet,
  cards: ReadonlyMap<string, CardState>,
): DirectionStages[] {
  const counts = phaseCounts(set, cards);
  const term = languageName(set.termLanguage);
  const meaning = languageName(set.meaningLanguage);
  return [
    {
      label: `${term} → ${meaning}`,
      spoken: `${term} nach ${meaning}`,
      counts: counts.termToMeaning,
    },
    {
      label: `${meaning} → ${term}`,
      spoken: `${meaning} nach ${term}`,
      counts: counts.meaningToTerm,
    },
  ];
}

const STAGES: readonly Stage[] = ["secure", "building", "fresh"];
const STAGE_NAMES: Record<Stage, string> = {
  secure: "sicher",
  building: "im Aufbau",
  fresh: "neu",
};

/** „12 sicher · 20 im Aufbau · 25 neu“; Stufen ohne Vokabel entfallen. */
export function describeStages(counts: StageCounts, separator = " · "): string {
  const parts = STAGES.filter((stage) => counts[stage] > 0).map(
    (stage) => `${counts[stage]} ${STAGE_NAMES[stage]}`,
  );
  return parts.length > 0 ? parts.join(separator) : `0 ${STAGE_NAMES.fresh}`;
}

/** Geteilter Balken: sicher, im Aufbau, der Rest ist neu. */
export function splitTrack(counts: StageCounts): HTMLElement {
  const total = counts.secure + counts.building + counts.fresh;
  const part = (stage: Stage) => {
    const span = h("span", { class: stage });
    span.style.width = `${total > 0 ? (counts[stage] / total) * 100 : 0}%`;
    return span;
  };
  return h(
    "span",
    { class: "track split", "aria-hidden": "true" },
    part("secure"),
    part("building"),
  );
}

/**
 * Inhalt der Zeile in der Bibliothek: „zuletzt gestern“ und ein geteilter Balken über beide Richtungen
 * (D-62); vorgelesen werden die Stufen je Richtung. Ohne Sitzung „Neu · noch nicht gelernt“.
 */
export function libraryStatus(
  overview: Overview,
  directions: readonly DirectionStages[],
  now: Date,
): Child[] {
  if (overview.sessions === 0 || !overview.lastAt)
    return [h("span", { class: "new" }, "Neu"), " ", h("span", null, "· noch nicht gelernt")];
  const sum: StageCounts = { secure: 0, building: 0, fresh: 0 };
  for (const { counts } of directions) for (const stage of STAGES) sum[stage] += counts[stage];
  const spoken = directions
    .map(({ spoken, counts }) => `${spoken}: ${describeStages(counts, ", ")}`)
    .join("; ");
  return [
    h("span", null, `zuletzt ${describeDay(overview.lastAt, now)}`),
    // Leerzeichen trennen die Teile im vorgelesenen Text; im Flex-Container fallen sie optisch weg.
    " ",
    splitTrack(sum),
    h("span", { class: "visually-hidden" }, ` Lernstand ${spoken}`),
  ];
}
