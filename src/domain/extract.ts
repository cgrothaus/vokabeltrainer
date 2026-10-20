// JSON aus eingefügtem Text herauslösen (TDD 8.2). Weitere Reparaturen, z. B. abschließende Kommas,
// werden nicht versucht. Die Fundstelle eines Fehlers ermittelt ein eigener Syntaxprüfer (D-23), weil
// Safari bei `JSON.parse` keine Position meldet.

export type ExtractResult =
  /** `trimmed`: Es wurde mehr als Leerraum entfernt, z. B. Begleittext oder Codeblock-Zeichen. */
  { ok: true; value: unknown; trimmed: boolean } | { ok: false; error: string };

const NOT_FOUND =
  "Im Text wurde kein Vokabelset gefunden. Füge die vollständige Antwort mit dem JSON-Codeblock ein.";
const TRUNCATED =
  "Der Text endet, bevor das Vokabelset vollständig ist. Wurde die Antwort ganz kopiert?";

const BOM = String.fromCharCode(0xfeff);

// Ein Codeblock darf am Ende offen bleiben, etwa wenn die Antwort abgeschnitten ist.
const CODE_BLOCK = /```[^\n]*\n([\s\S]*?)(?:```|$)/g;

export function extractJson(input: string): ExtractResult {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const range = locateJson(text);
  if (!range) return { ok: false, error: NOT_FOUND };
  const json = text.slice(range.start, range.end);
  try {
    const value: unknown = JSON.parse(json);
    return { ok: true, value, trimmed: json !== text.trim() };
  } catch {
    return { ok: false, error: describeError(text, range.start, json) };
  }
}

/** Erster Codeblock, der mit `{` beginnt; sonst vom ersten `{` bis zum letzten `}`. */
function locateJson(text: string): { start: number; end: number } | null {
  for (const match of text.matchAll(CODE_BLOCK)) {
    const content = match[1]!;
    const lead = content.length - content.trimStart().length;
    if (content[lead] !== "{") continue;
    const contentStart = match.index + match[0].indexOf("\n") + 1;
    return { start: contentStart + lead, end: contentStart + content.trimEnd().length };
  }
  const start = text.indexOf("{");
  if (start === -1) return null;
  const last = text.lastIndexOf("}");
  return { start, end: last > start ? last + 1 : text.trimEnd().length };
}

type Problem =
  | "end"
  | "comma"
  | "trailingComma"
  | "key"
  | "colon"
  | "value"
  | "typographicQuote"
  | "singleQuote"
  | "string"
  | "escape"
  | "rest";

const QUOTE = '(")';
const REASONS: Record<Exclude<Problem, "end">, string> = {
  comma: "Hier fehlt ein Komma oder eine schließende Klammer.",
  trailingComma: "Nach dem letzten Element steht ein Komma zu viel.",
  key: `Feldnamen müssen in geraden doppelten Anführungszeichen ${QUOTE} stehen.`,
  colon: "Nach dem Feldnamen fehlt ein Doppelpunkt.",
  value: `Hier wird ein Wert erwartet, zum Beispiel ein Text in geraden doppelten Anführungszeichen ${QUOTE}.`,
  typographicQuote: `Typografische Anführungszeichen sind nicht erlaubt. Verwende gerade doppelte Anführungszeichen ${QUOTE}.`,
  singleQuote: "Texte und Feldnamen müssen in doppelten statt einfachen Anführungszeichen stehen.",
  string: "Ein Text ist nicht abgeschlossen oder enthält einen Zeilenumbruch.",
  escape: "Nach einem umgekehrten Schrägstrich (\\) steht ein ungültiges Zeichen.",
  rest: "Nach dem Ende des Vokabelsets folgt weiterer Inhalt.",
};

function describeError(text: string, offset: number, json: string): string {
  const problem = findJsonError(json);
  if (!problem) return "Der Text enthält kein gültiges JSON.";
  if (problem.kind === "end") return TRUNCATED;
  const { line, column } = position(text, offset + problem.offset);
  return `Fehler im JSON in Zeile ${line}, Spalte ${column}: ${REASONS[problem.kind]}`;
}

function position(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let k = text.indexOf("\n"); k !== -1 && k < offset; k = text.indexOf("\n", k + 1)) {
    line++;
    lineStart = k + 1;
  }
  return { line, column: offset - lineStart + 1 };
}

const TOKEN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

function quoteProblem(char: string | undefined): Problem | null {
  if (char === "'") return "singleQuote";
  if (char !== undefined && "„“”‚‘’".includes(char)) return "typographicQuote";
  return null;
}

/**
 * Sucht den ersten Syntaxfehler nach RFC 8259. Iterativ statt rekursiv, damit tief verschachtelte
 * Eingaben keinen Stapelüberlauf auslösen. Fehlende Kommas und Doppelpunkte werden direkt hinter dem
 * vorigen Element gemeldet, ein überzähliges Komma an seiner Stelle.
 */
function findJsonError(json: string): { kind: Problem; offset: number } | null {
  let i = 0;
  /** Ende des zuletzt vollständig gelesenen Elements. */
  let lastEnd = 0;
  /** Erwartete schließende Klammern. */
  const stack: string[] = [];

  const fail = (kind: Problem, at = i) =>
    i >= json.length ? { kind: "end" as const, offset: i } : { kind, offset: at };

  const skipWhitespace = () => {
    for (let c = json.charCodeAt(i); c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;)
      c = json.charCodeAt(++i);
  };

  const readString = () => {
    i++;
    for (;;) {
      if (i >= json.length) return fail("end");
      const c = json.charCodeAt(i);
      if (c === 0x22) {
        i++;
        lastEnd = i;
        return null;
      }
      if (c === 0x5c) {
        const escaped = json[i + 1];
        if (escaped === undefined) return fail("end", ++i);
        if ('"\\/bfnrt'.includes(escaped)) i += 2;
        else if (escaped === "u" && /^[0-9a-fA-F]{4}$/.test(json.slice(i + 2, i + 6))) i += 6;
        else return fail("escape");
      } else if (c < 0x20) {
        return fail("string");
      } else {
        i++;
      }
    }
  };

  let state: "value" | "key" | "after" = "value";
  for (;;) {
    skipWhitespace();
    const c = json[i];

    if (state === "value") {
      if (c === "{" || c === "[") {
        const close = c === "{" ? "}" : "]";
        i++;
        skipWhitespace();
        if (json[i] === close) {
          lastEnd = ++i;
          state = "after";
        } else {
          stack.push(close);
          state = close === "}" ? "key" : "value";
        }
        continue;
      }
      if (c === '"') {
        const problem = readString();
        if (problem) return problem;
        state = "after";
        continue;
      }
      TOKEN.lastIndex = i;
      const token = TOKEN.exec(json);
      if (!token) return fail(quoteProblem(c) ?? "value");
      lastEnd = i += token[0].length;
      state = "after";
      continue;
    }

    if (state === "key") {
      if (c !== '"') return fail(quoteProblem(c) ?? "key");
      const problem = readString();
      if (problem) return problem;
      skipWhitespace();
      if (json[i] !== ":") return fail("colon", lastEnd);
      i++;
      state = "value";
      continue;
    }

    const close = stack.at(-1);
    if (close === undefined) return i < json.length ? fail("rest") : null;
    if (c === close) {
      stack.pop();
      lastEnd = ++i;
    } else if (c === ",") {
      const comma = i++;
      skipWhitespace();
      if (json[i] === close) return fail("trailingComma", comma);
      state = close === "}" ? "key" : "value";
    } else {
      return fail("comma", lastEnd);
    }
  }
}
