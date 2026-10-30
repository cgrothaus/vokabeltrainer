// Mehrere Tabs (TDD 3.4, D-43): Nach einer Änderung an Sets oder Einstellungen erfahren andere Tabs
// derselben App davon und zeichnen ihre Leseansichten neu. Der eigene Tab erhält seine Nachricht nicht.
// Ohne `BroadcastChannel` bleibt es beim Stand bis zum nächsten Seitenwechsel.

const CHANNEL = "vokabeltrainer";

type Message = { type: "data-changed" };

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;

export function announceChange(): void {
  channel?.postMessage({ type: "data-changed" } satisfies Message);
}

export function onChangeElsewhere(callback: () => void): void {
  channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
    if ((event.data as Partial<Message> | null)?.type === "data-changed") callback();
  });
}
