import "./styles/main.css";
import { checkBackup, lastBackupAt, prepareBackup, restore, saveBackup } from "./app/backup";
import { mountUpdateNotice, showUpdateNotice } from "./app/components/updateNotice";
import { dataScope, removeAllData } from "./app/deleteAll";
import { deletionScope, removeSet } from "./app/deleteSet";
import { loadSpec, newSetPrompt, shareSpec } from "./app/help";
import { loadOverview } from "./app/overview";
import { previewImport, saveImport } from "./app/importText";
import { loadSampleSet } from "./app/sampleSet";
import { beginPractice, currentPractice, loadSetup } from "./app/practice";
import { startRouter } from "./app/router";
import { applyTheme, loadTheme, saveTheme } from "./app/theme";
import { backupView } from "./app/views/backup";
import { helpView } from "./app/views/help";
import { importView } from "./app/views/import";
import { learnView } from "./app/views/learn";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";
import { practiceView } from "./app/views/practice";
import { setView } from "./app/views/set";
import { settingsView } from "./app/views/settings";
import { storageErrorView } from "./app/views/storageError";
import { canReadClipboard, copyText, readClipboard } from "./platform/clipboard";
import { persistenceState, requestPersistence } from "./platform/persistence";
import type { StoredSet } from "./domain/model";
import type { PracticeSetup } from "./domain/practiceSetup";
import type { Theme } from "./domain/theme";
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
  // Vor der ersten Ansicht (TDD 13.5); bis die Datenbank offen ist, gilt die Darstellung des Geräts.
  let theme: Theme = await loadTheme(db);
  const showTheme = (chosen: Theme) => {
    theme = chosen;
    applyTheme(chosen);
  };
  showTheme(theme);
  // Meldung nach Import oder Löschen für die Bibliothek; lebt nur bis zum nächsten Anzeigen.
  let message: string | null = null;
  const library = () =>
    libraryView({
      persistence,
      requestPersistence: askForPersistence,
      loadSets: () => listSets(db),
      loadSampleSet: async () => {
        const outcome = await loadSampleSet(db);
        if (outcome.ok) {
          void askOnceAfterSave();
          // Die Set-Ansicht zeigt den Inhalt und „Lernen“; die Bibliothek zeichnete `#/` nicht neu.
          location.hash = `#/set/${encodeURIComponent(outcome.id)}`;
        }
        return outcome;
      },
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
      loadOverview: (set) => loadOverview(db, set),
      deletionScope: (set) => deletionScope(db, set),
      removeSet: (set) => removeSet(db, set),
      onRemoved: (removed) => {
        message = removed;
        location.hash = "#/";
      },
    });
  const learnPage = (_signal: AbortSignal, id: string) =>
    learnView({
      loadSet: () => getSet(db, id),
      loadSetup: (set) => loadSetup(db, set),
      startPractice: async (set: StoredSet, setup: PracticeSetup) => {
        await beginPractice(db, set, setup);
        location.hash = "#/practice";
      },
    });
  const practicePage = (signal: AbortSignal) => practiceView(currentPractice(), signal);
  const backupPage = () =>
    backupView({
      prepareBackup: () => prepareBackup(db, __APP_VERSION__),
      saveBackup: (prepared) => saveBackup(db, prepared),
      lastBackupAt: () => lastBackupAt(db),
      checkBackup,
      restore: async (backup) => {
        const outcome = await restore(db, backup);
        // Das Backup bringt seine Darstellung mit.
        if (outcome.ok) showTheme(await loadTheme(db));
        return outcome;
      },
    });
  const settingsPage = () =>
    settingsView({
      theme,
      chooseTheme: (chosen) => {
        showTheme(chosen);
        return saveTheme(db, chosen);
      },
      dataScope: () => dataScope(db),
      removeAllData: () => removeAllData(db),
      onRemoved: (removed) => {
        showTheme("system");
        message = removed;
        location.hash = "#/";
      },
      appVersion: __APP_VERSION__,
    });
  const helpPage = () => helpView({ prompt: newSetPrompt(), copyText, loadSpec, shareSpec });
  stopRouter = startRouter(
    root!,
    {
      "/": library,
      "/set/": setPage,
      "/import": importPage,
      "/help": helpPage,
      "/learn/": learnPage,
      "/practice": practicePage,
      "/backup": backupPage,
      "/settings": settingsPage,
    },
    notFoundView,
  );
}

void start();
