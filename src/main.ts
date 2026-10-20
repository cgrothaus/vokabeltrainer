import "./styles/main.css";
import { mountUpdateNotice, showUpdateNotice } from "./app/components/updateNotice";
import { importText } from "./app/importText";
import { beginPractice, currentPractice } from "./app/practice";
import { startRouter } from "./app/router";
import { importView } from "./app/views/import";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";
import { practiceView } from "./app/views/practice";
import { storageErrorView } from "./app/views/storageError";
import { persistenceState, requestPersistence } from "./platform/persistence";
import { registerServiceWorker } from "./platform/serviceWorker";
import { type OpenOptions, type OpenResult, openDatabase } from "./storage/database";
import { getMeta, setMeta } from "./storage/meta";
import { interruptActiveSessions } from "./storage/sessions";
import { listSets } from "./storage/sets";

declare const __APP_VERSION__: string;

const root = document.getElementById("app");
const notice = document.getElementById("update-notice");
if (!root || !notice) throw new Error("Element #app oder #update-notice fehlt");

// Updates unabhängig vom Speicher anbieten: Eine neue Version kann ein Problem beim Öffnen beheben.
mountUpdateNotice(notice);
registerServiceWorker(showUpdateNotice);

let stopRouter: (() => void) | null = null;

function show(view: Node): void {
  stopRouter?.();
  stopRouter = null;
  root!.replaceChildren(view);
}

async function open(): Promise<OpenResult> {
  const options: OpenOptions = {
    appVersion: __APP_VERSION__,
    onBlocked: () => show(storageErrorView({ reason: "blocked" })),
    onVersionChange: () => show(storageErrorView({ reason: "replaced" })),
  };
  if (import.meta.env.DEV) {
    const mode = new URLSearchParams(location.search).get("testmigration");
    if (mode === "ok" || mode === "fail") {
      const { openWithTestMigration } = await import("./storage/testMigration");
      return openWithTestMigration(mode, options);
    }
  }
  return openDatabase(options);
}

async function start(): Promise<void> {
  const result = await open();
  if (!result.ok) return show(storageErrorView(result));
  const { db } = result;
  let persistence = await persistenceState();
  const askForPersistence = async () => {
    persistence = await requestPersistence();
    await setMeta(db, "persistRequested", true).catch((error: unknown) => {
      console.warn("Anfrage nach dauerhaftem Speicher nicht vermerkt", error);
    });
    return persistence;
  };
  // TDD 6.6: nach dem ersten gespeicherten Set einmal anfragen; danach zeigt die Bibliothek das Ergebnis.
  const askOnceAfterSave = async () => {
    const asked = await getMeta(db, "persistRequested").catch(() => true);
    if (!asked) await askForPersistence();
  };
  // Vor dem Routing abwarten, sonst träfe es eine gerade neu begonnene Sitzung (TDD 12.5).
  await interruptActiveSessions(db).catch((error: unknown) => {
    console.warn("Unterbrochene Sitzungen nicht vermerkt", error);
  });
  const library = () =>
    libraryView({
      persistence,
      requestPersistence: askForPersistence,
      loadSets: () => listSets(db),
      startPractice: async (set) => {
        await beginPractice(db, set);
        location.hash = "#/practice";
      },
    });
  const importPage = () =>
    importView({
      importText: (text) => importText(db, text),
      onSaved: () => void askOnceAfterSave(),
    });
  const practicePage = (signal: AbortSignal) => practiceView(currentPractice(), signal);
  stopRouter = startRouter(
    root!,
    { "/": library, "/import": importPage, "/practice": practicePage },
    notFoundView,
  );
}

void start();
