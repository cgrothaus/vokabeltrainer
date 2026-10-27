import { describe, expect, it } from "vitest";
import { isConnectionLost, storageFailure } from "./errors";

const domError = (name: string) => new DOMException("Fehler", name);

describe("storageFailure", () => {
  it("erkennt einen vollen Speicher", () => {
    expect(storageFailure(domError("QuotaExceededError"))).toBe("quota");
  });

  it("erkennt eine verlorene Verbindung", () => {
    expect(storageFailure(domError("InvalidStateError"))).toBe("connection");
    // Safari auf iOS: „Connection to Indexed Database server lost“
    expect(storageFailure(domError("UnknownError"))).toBe("connection");
  });

  it("ordnet alles andere als allgemeinen Fehler ein", () => {
    expect(storageFailure(domError("AbortError"))).toBe("failed");
    expect(storageFailure(domError("ConstraintError"))).toBe("failed");
    expect(storageFailure(new Error("kaputt"))).toBe("failed");
    expect(storageFailure("kaputt")).toBe("failed");
    expect(storageFailure(null)).toBe("failed");
    expect(storageFailure(undefined)).toBe("failed");
  });

  it("nimmt auch Fehlerobjekte, die nur einen Namen tragen", () => {
    expect(storageFailure({ name: "QuotaExceededError" })).toBe("quota");
  });
});

describe("isConnectionLost", () => {
  it("gilt genau für die Fehler einer verlorenen Verbindung", () => {
    expect(isConnectionLost(domError("InvalidStateError"))).toBe(true);
    expect(isConnectionLost(domError("UnknownError"))).toBe(true);
    expect(isConnectionLost(domError("QuotaExceededError"))).toBe(false);
    expect(isConnectionLost(null)).toBe(false);
  });
});
