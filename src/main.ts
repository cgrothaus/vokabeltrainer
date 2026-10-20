import "./styles/main.css";
import { mountUpdateNotice, showUpdateNotice } from "./app/components/updateNotice";
import { startRouter } from "./app/router";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";
import { storageErrorView } from "./app/views/storageError";
import { persistenceState, requestPersistence } from "./platform/persistence";
import { registerServiceWorker } from "./platform/serviceWorker";
import { type OpenOptions, type OpenResult, openDatabase } from "./storage/database";
import { setMeta } from "./storage/meta";

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
  const library = () =>
    libraryView({
      persistence,
      requestPersistence: async () => {
        persistence = await requestPersistence();
        await setMeta(db, "persistRequested", true).catch((error: unknown) => {
          console.warn("Anfrage nach dauerhaftem Speicher nicht vermerkt", error);
        });
        return persistence;
      },
    });
  stopRouter = startRouter(root!, { "/": library }, notFoundView);
}

void start();
