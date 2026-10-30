// Set- und Sektionsexport (TDD 11.1, 11.2): Datei in domain/exportSet.ts, Ausliefern in
// platform/deliverFile.ts. Alles hier ist synchron bis zum Aufruf von `share()`, damit die Nutzergeste
// frisch bleibt.
import { type ExportScope, exportFileName, exportSetFile } from "../domain/exportSet";
import type { StoredSet } from "../domain/model";
import { type Delivery, deliverFile } from "../platform/deliverFile";

export interface PreparedExport {
  text: string;
  filename: string;
}

export function prepareExport(
  set: StoredSet,
  scope: ExportScope,
  now = new Date(),
): PreparedExport {
  return {
    text: `${JSON.stringify(exportSetFile(set, scope, now), null, 2)}\n`,
    filename: exportFileName(set, scope, now),
  };
}

export function deliverExport(prepared: PreparedExport): Promise<Delivery> {
  return deliverFile(new Blob([prepared.text], { type: "application/json" }), prepared.filename);
}
