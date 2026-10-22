// Gespeichertes Datenmodell (TDD 6.2). Intern immer in Langform; die Reihenfolge der Arrays ist maßgeblich.

export type ReviewStatus = "unchecked" | "checked";

export interface Answer {
  text: string;
  acceptedVariants?: string[];
}

export interface StoredEntry {
  /** 6 Zeichen, beim Import auch fremde IDs (TDD 6.3). */
  id: string;
  term: Answer;
  /** Mindestens eine. */
  meanings: Answer[];
  notes?: string;
  examples?: { text: string; translation?: string }[];
  grammar?: { partOfSpeech?: string; gender?: string; plural?: string; forms?: string[] };
  reviewStatus?: ReviewStatus;
}

export interface StoredSection {
  /** 6 Zeichen, beim Import auch fremde IDs. */
  id: string;
  title: string;
  entries: StoredEntry[];
}

export interface StoredSet {
  /** 10 Zeichen, beim Import auch fremde IDs. */
  id: string;
  /** +1 bei jeder Änderung; Grundlage der Prüfung veralteter Vorschauen (TAK-07). */
  editCount: number;
  /** ISO 8601, UTC. */
  createdAt: string;
  updatedAt: string;
  title: string;
  /** BCP 47, kanonisiert. */
  termLanguage: string;
  meaningLanguage: string;
  level?: string;
  textbook?: string;
  edition?: string;
  source?: string;
  license?: string;
  notes?: string;
  reviewStatus?: ReviewStatus;
  sections: StoredSection[];
}

export type Direction = "termToMeaning" | "meaningToTerm";

/** Eine Antwort (TDD 12.4); wird sofort und einzeln gespeichert. */
export interface ReviewEvent {
  /** 12 Zeichen. */
  id: string;
  sessionId: string;
  setId: string;
  entryId: string;
  /** `rev` des Eintrags zum Zeitpunkt der Antwort (R-04). */
  entryRev: string;
  /** ISO 8601, UTC. */
  occurredAt: string;
  direction: Direction;
  mode: "flashcard" | "multipleChoice";
  /** Bei Selbstbewertung: `correct` = „gewusst“, `incorrect` = „nochmal“. */
  result: "correct" | "incorrect";
  /** Nur die erste Antwort zu einem Eintrag in einer Sitzung. */
  firstAttempt: boolean;
}

export type SessionStatus = "active" | "completed" | "ended" | "interrupted";

/** Eine Lernsitzung (TDD 12.5). Kennzahlen werden aus den Events berechnet, nicht hier gespeichert. */
export interface Session {
  /** 12 Zeichen. */
  id: string;
  setId: string;
  sectionIds: string[];
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  config: { direction: Direction | "mixed"; count: number; mcShare: number };
  /** „Nur Fehler üben“: die Sitzung, deren Fehler hier wiederholt werden (D-29). */
  repeatOf?: string;
}
