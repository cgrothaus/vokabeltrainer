import "./styles/main.css";
import { checkBackup, lastBackupAt, prepareBackup, restore, saveBackup } from "./app/backup";
import { mountUpdateNotice, showUpdateNotice } from "./app/components/updateNotice";
import { deletionScope, removeSet } from "./app/deleteSet";
import { previewImport, saveImport } from "./app/importText";
import { beginPractice, currentPractice } from "./app/practice";
import { startRouter } from "./app/router";
import { backupView } from "./app/views/backup";
import { importView } from "./app/views/import";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";
import { practiceView } from "./app/views/practice";
import { setView } from "./app/views/set";
import { storageErrorView } from "./app/views/storageError";
import { canReadClipboard, readClipboard } from "./platform/clipboard";
import { persistenceState, requestPersistence } from "./platform/persistence";
import type { StoredSet } from "./domain/model";
import { registerServiceWorker } from "./platform/serviceWorker";
import { type OpenOptions, type OpenResult, openDatabase } from "./storage/database";
import { getMeta, setMeta } from "./storage/meta";
import { interruptActiveSessions } from "./storage/sessions";
import { getSet, listSets } from "./storage/sets";

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
  // Meldung nach Import oder Löschen für die Bibliothek; lebt nur bis zum nächsten Anzeigen.
  let message: string | null = null;
  const startPractice = async (set: StoredSet) => {
    await beginPractice(db, set);
    location.hash = "#/practice";
  };
  const library = () =>
    libraryView({
      persistence,
      requestPersistence: askForPersistence,
      loadSets: () => listSets(db),
      startPractice,
      takeMessage: () => {
        const taken = message;
        message = null;
        return taken;
      },
    });
  const importPage = () =>
    importView({
      previewImport: (text) => previewImport(db, text),
      saveImport: (set) => saveImport(db, set),
      readClipboard: canReadClipboard() ? readClipboard : null,
      onSaved: (saved) => {
        void askOnceAfterSave();
        message = saved;
        location.hash = "#/";
      },
    });
  const setPage = (_signal: AbortSignal, id: string) =>
    setView({
      loadSet: () => getSet(db, id),
      startPractice,
      deletionScope: (set) => deletionScope(db, set),
      removeSet: (set) => removeSet(db, set),
      onRemoved: (removed) => {
        message = removed;
        location.hash = "#/";
      },
    });
  const practicePage = (signal: AbortSignal) => practiceView(currentPractice(), signal);
  const backupPage = () =>
    backupView({
      prepareBackup: () => prepareBackup(db, __APP_VERSION__),
      saveBackup: (prepared) => saveBackup(db, prepared),
      lastBackupAt: () => lastBackupAt(db),
      checkBackup,
      restore: (backup) => restore(db, backup),
    });
  stopRouter = startRouter(
    root!,
    {
      "/": library,
      "/set/": setPage,
      "/import": importPage,
      "/practice": practicePage,
      "/backup": backupPage,
    },
    notFoundView,
  );
}

void start();
