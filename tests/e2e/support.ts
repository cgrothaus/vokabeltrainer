// Gemeinsame Helfer der E2E-Tests. Die Vokabeln sind frei gewählter Grundwortschatz.
import { expect, type Locator, type Page } from "@playwright/test";

/** Drei Einträge; `rain`, `sun` und `autumn` mit ihren Bedeutungen. */
export function setFile(title: string, id?: string): string {
  return JSON.stringify(
    {
      format: "vokabeltrainer-set",
      formatVersion: 1,
      set: { ...(id && { id }), title, termLanguage: "en", meaningLanguage: "de" },
      sections: [
        {
          title: "Wetter",
          entries: [
            { term: "rain", meanings: ["Regen"] },
            { term: "sun", meanings: ["Sonne"] },
            { term: { text: "autumn", acceptedVariants: ["fall"] }, meanings: ["Herbst"] },
          ],
        },
      ],
    },
    null,
    2,
  );
}

/** Bedeutungen der Einträge aus `setFile`. */
export const MEANINGS: Record<string, string> = { rain: "Regen", sun: "Sonne", autumn: "Herbst" };

/** Titel und Zahl der Einträge je Set in der Bibliothek, ohne die Schaltflächen. */
export const librarySets = (page: Page) =>
  page.getByRole("region", { name: "Vokabelsets" }).getByRole("listitem").locator("div");

/** Sammelt Fehler aus der Seite; die Abläufe sollen auch im Fehlerfall keine erzeugen. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** Importiert ein Set über das Textfeld und die Vorschau; die Seite steht danach in der Bibliothek. */
export async function importSet(page: Page, title: string, base = "./"): Promise<void> {
  await importText(page, setFile(title), `„${title}“ mit 3 Einträgen gespeichert.`, base);
}

/** Wie `importSet` mit beliebigem Text; `saved` ist die erwartete Meldung in der Bibliothek. */
export async function importText(page: Page, text: string, saved: string, base = "./") {
  await page.goto(`${base}#/import`);
  await page.getByLabel("Text einfügen").fill(text);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(libraryMessage(page)).toHaveText(saved);
}

/** „<Titel> lernen“ in Bibliothek oder Set-Ansicht, dann Start mit der vorbelegten Einrichtung. */
export async function startLearning(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: `${title} lernen` }).click();
  await page.getByRole("button", { name: /^\d+ Vokabeln? lernen$/ }).click();
}

/** Beendet eine Sitzung mit mindestens einer Antwort über den Zwischenstand; endet in der Bibliothek. */
export async function endPractice(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Beenden" }).click();
  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
}

/** Meldung oben in der Bibliothek, z. B. nach dem Import; die Hinweisleiste für Updates zählt nicht. */
export const libraryMessage = (page: Page) => page.getByRole("main").getByRole("status");

/** Liest alle Datensätze eines Stores direkt aus der Datenbank der App. */
export function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const request = indexedDB.open("vokabeltrainer");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction(store).objectStore(store).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as T[]);
          };
          all.onerror = () => reject(all.error);
        };
      }),
    store,
  );
}

interface StorageSwitches {
  __failWrites?: { name: string; store?: string };
  __loseConnection?: boolean;
}

/**
 * Macht den Speicher der Seite störbar (AK-26): Mit `failWrites` werfen `add`, `put`, `delete` und
 * `clear` den angegebenen Fehler, auf Wunsch nur für einen Store; mit `loseConnection` schließt der
 * nächste Zugriff erst die Verbindung, wie wenn der Browser sie verloren hätte. Vor `goto` aufrufen.
 */
export async function breakableStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const switches = window as unknown as StorageSwitches;
    for (const method of ["add", "put", "delete", "clear"] as const) {
      const original = IDBObjectStore.prototype[method] as (...args: unknown[]) => IDBRequest;
      Object.defineProperty(IDBObjectStore.prototype, method, {
        value: function (this: IDBObjectStore, ...args: unknown[]) {
          const failure = switches.__failWrites;
          if (failure && (!failure.store || failure.store === this.name))
            throw new DOMException("Speicherfehler (Test)", failure.name);
          return original.apply(this, args);
        },
      });
    }
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args) {
      if (switches.__loseConnection) {
        switches.__loseConnection = false;
        this.close();
      }
      return transaction.apply(this, args);
    };
  });
}

/** `null` beendet die Störung. */
export function failWrites(page: Page, name: string | null, store?: string): Promise<void> {
  return page.evaluate(
    ([name, store]) => {
      (window as unknown as StorageSwitches).__failWrites = name ? { name, store } : undefined;
    },
    [name, store] as const,
  );
}

export function loseConnection(page: Page): Promise<void> {
  return page.evaluate(() => {
    (window as unknown as StorageSwitches).__loseConnection = true;
  });
}

/** Gespielter Gerätezustand für den Speicherschutz (TDD 6.6); liegt in `localStorage`. */
export interface FakeDevice {
  ios: boolean;
  installed: boolean;
  /** Ergebnis von `persisted()`. */
  granted: boolean;
  /** `persist()` gewährt, wie Chrome und Safari bei einer installierten App. */
  grantsWhenInstalled: boolean;
  /** Zahl der Aufrufe von `persist()`. */
  asked: number;
}

const FAKE_DEVICE = "fake-device";

/**
 * Ersetzt Gerät und Speicherschutz: iOS oder Android im User-Agent, Start vom Home-Bildschirm und
 * `navigator.storage.persisted`/`persist`. Der Zustand überlebt das Neuladen. Vor `goto` aufrufen.
 */
export async function fakeDevice(page: Page, device: Partial<FakeDevice>): Promise<void> {
  const initial: FakeDevice = {
    ios: false,
    installed: false,
    granted: false,
    grantsWhenInstalled: false,
    asked: 0,
    ...device,
  };
  await page.addInitScript(
    ([key, initial]) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(key);
      } catch {
        return; // z. B. about:blank
      }
      const read = (): FakeDevice => (stored ? (JSON.parse(stored) as FakeDevice) : initial);
      const write = (state: FakeDevice) => {
        stored = JSON.stringify(state);
        localStorage.setItem(key, stored);
      };
      if (!stored) write(initial);
      const state = read();
      const agent = state.ios
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 16; SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
      Object.defineProperty(Navigator.prototype, "userAgent", { get: () => agent });
      Object.defineProperty(Navigator.prototype, "platform", {
        get: () => (state.ios ? "iPhone" : "Linux armv8l"),
      });
      Object.defineProperty(Navigator.prototype, "standalone", { get: () => state.installed });
      Object.defineProperty(StorageManager.prototype, "persisted", {
        value: async () => read().granted,
      });
      Object.defineProperty(StorageManager.prototype, "persist", {
        value: async () => {
          const current = read();
          current.asked += 1;
          current.granted ||= current.installed && current.grantsWhenInstalled;
          write(current);
          return current.granted;
        },
      });
    },
    [FAKE_DEVICE, initial] as const,
  );
}

export function readDevice(page: Page): Promise<FakeDevice> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as FakeDevice, FAKE_DEVICE);
}

/** Ändert den gespielten Zustand; wirkt nach dem nächsten Laden. */
export function changeDevice(page: Page, change: Partial<FakeDevice>): Promise<void> {
  return page.evaluate(
    ([key, change]) => {
      const state = JSON.parse(localStorage.getItem(key)!) as FakeDevice;
      localStorage.setItem(key, JSON.stringify({ ...state, ...change }));
    },
    [FAKE_DEVICE, change] as const,
  );
}

/** Wischt waagerecht über die Mitte des Elements (Pointer-Events wie mit der Maus). */
export async function swipe(page: Page, target: Locator, dx: number): Promise<void> {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 6 });
  await page.mouse.up();
}
