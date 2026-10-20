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
