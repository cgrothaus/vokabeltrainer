// Schutz vor Datenverlust in Formularen (TDD 10, D-41): Wie die Lernsitzung (D-29) liegt das Formular
// auf einem zusätzlichen Verlaufseintrag mit derselben Adresse. Die Zurück-Taste löst so kein
// `hashchange` aus; mit Änderungen fragt die Ansicht nach, sonst geht es gleich weiter zurück.
// Neuladen und Schließen fragt der Browser selbst (`beforeunload`). Solange das Formular offen ist,
// bleibt eine neue App-Version zurückgehalten (TAK-12).
import { hasPreviousView } from "../router";
import { setUpdateBlocked } from "./updateNotice";

const EDITING = "editing";

export interface GuardOptions {
  signal: AbortSignal;
  /** Wohin „Verlassen“ führt, wenn es im Verlauf nichts davor gibt (z. B. direkt geöffnet). */
  fallback: string;
  /** Ob es ungespeicherte Änderungen gibt. */
  changed: () => boolean;
  /** Zurück mit Änderungen: Die Ansicht zeigt die Frage „Speichern / Verwerfen / Weiter bearbeiten“. */
  ask: () => void;
  /** Vorwärts nach der Frage: wie „Weiter bearbeiten“. */
  resume: () => void;
}

export interface UnsavedGuard {
  /** Verlässt das Formular dorthin, woher es geöffnet wurde (nach Speichern oder Verwerfen). */
  leave: () => void;
  /** Nach der Frage weiter bearbeiten; Zurück fragt dann wieder. */
  stay: () => void;
}

export function guardUnsaved(options: GuardOptions): UnsavedGuard {
  const { signal } = options;
  const hash = location.hash;
  // Nach dem Neuladen steht der zusätzliche Eintrag schon da; davor liegt dann die Ansicht, aus der
  // das Formular einmal geöffnet wurde.
  const canGoBack = hasPreviousView() || history.state === EDITING;
  let leaving = false;

  setUpdateBlocked(true);
  signal.addEventListener("abort", () => setUpdateBlocked(false));

  const onForm = () => history.state === EDITING;
  const stay = () => {
    if (!onForm()) history.pushState(EDITING, "");
  };
  stay();

  const leave = () => {
    leaving = true;
    if (canGoBack) history.go(onForm() ? -2 : -1);
    else location.replace(options.fallback);
  };

  window.addEventListener(
    "popstate",
    () => {
      // Auf eine andere Seite: Der Router verlässt die Ansicht.
      if (leaving || location.hash !== hash) return;
      if (onForm()) options.resume();
      else if (options.changed()) options.ask();
      else leave();
    },
    { signal },
  );
  window.addEventListener(
    "beforeunload",
    (event) => {
      if (!leaving && options.changed()) event.preventDefault();
    },
    { signal },
  );

  return { leave, stay };
}
