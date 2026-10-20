// Zufallsquelle für IDs (TDD 6.3). domain/ kennt kein `crypto` und bekommt sie übergeben.
import type { RandomBytes } from "../domain/ids";

export const randomBytes: RandomBytes = (count) => crypto.getRandomValues(new Uint8Array(count));
