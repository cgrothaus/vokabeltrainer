// Mehrere Tabs (TDD 3.4, D-43): Nach einer Änderung an Sets oder Einstellungen erfahren andere Tabs
// derselben App davon und zeichnen ihre Leseansichten neu. Nach neuen Antworten verwerfen sie nur den
// Lernstand im Zwischenspeicher (D-48). Der eigene Tab erhält seine Nachricht nicht.
// Ohne `BroadcastChannel` bleibt es beim Stand bis zum nächsten Seitenwechsel.

const CHANNEL = "vokabeltrainer";

type Message = { type: "data-changed" } | { type: "answers-recorded" };

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;

function announce(type: Message["type"]): void {
  channel?.postMessage({ type } satisfies Message);
}

function listen(type: Message["type"], callback: () => void): void {
  channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
    if ((event.data as Partial<Message> | null)?.type === type) callback();
  });
}

export const announceChange = () => announce("data-changed");
export const announceAnswers = () => announce("answers-recorded");

export const onChangeElsewhere = (callback: () => void) => listen("data-changed", callback);
export const onAnswersElsewhere = (callback: () => void) => listen("answers-recorded", callback);
