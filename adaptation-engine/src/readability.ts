/**
 * Readability, computed in code rather than asked of a model.
 *
 * RL-01 and RL-02 are checkable arithmetic. Asking a language model for a
 * Flesch-Kincaid score produces a plausible number that nobody can reproduce,
 * which is exactly the wrong property for a figure that appears on a
 * governance record. This module is deterministic: the same text always gives
 * the same numbers, and anyone can re-run it.
 *
 * The syllable counter is a heuristic, as every English syllable counter is.
 * It is documented rather than hidden, and it is applied identically to the
 * source and the adaptation, so the comparison between them is fair even where
 * the absolute figure is approximate.
 */

export interface SentenceStat {
  text: string;
  words: number;
  index: number;
}

export interface Readability {
  words: number;
  sentences: number;
  syllables: number;
  polysyllables: number;
  /** Flesch-Kincaid grade level. */
  fleschKincaidGrade: number;
  /** SMOG index. Generally the more conservative of the two on health text. */
  smog: number;
  /** RL-02 uses the higher of the two. */
  gradeLevel: number;
  meanWordsPerSentence: number;
  maxWordsPerSentence: number;
  sentencesOver15: number;
  sentencesOver20: number;
  longestSentences: SentenceStat[];
}

/** Strip markdown so list markers and headings do not count as words. */
function normalise(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\r/g, "");
}

/**
 * Rejoin hard-wrapped lines into the units a reader actually reads.
 *
 * Source documents arrive wrapped at 70-80 columns. Treating each wrapped line
 * as its own sentence reports a 42-word sentence as three short ones, which
 * flatters the readability figures on exactly the documents this system exists
 * to fix. Headings and list items stay separate: each is its own unit.
 */
function toLogicalLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) lines.push(current.trim());
    current = "";
  };

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^#{1,6}\s+/.test(line) || /^([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      current = line;
      continue;
    }
    current = current ? `${current} ${line}` : line;
  }
  flush();
  return lines;
}

export function splitSentences(text: string): string[] {
  return toLogicalLines(text)
    .flatMap((line) => normalise(line).split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[A-Za-z]/.test(s));
}

export function splitWords(text: string): string[] {
  return normalise(text)
    .split(/[^A-Za-z0-9'’./-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && /[A-Za-z0-9]/.test(w));
}

/**
 * Heuristic English syllable count. Vowel groups, minus a silent trailing "e",
 * plus the usual corrections. Numbers count as one syllable per digit group so
 * that "140/90" does not inflate the score of a sentence that is easy to read
 * and hard to simplify.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 1;
  if (w.length <= 3) return 1;

  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);

  let count = groups ? groups.length : 1;
  // Common endings the vowel-group rule gets wrong.
  if (/(?:ia|io|ua|uo)/.test(w)) count += 0;
  if (/le$/.test(w) && !/[aeiouy]le$/.test(w)) count += 1;
  return Math.max(1, count);
}

export function analyseReadability(text: string): Readability {
  const sentences = splitSentences(text);
  const sentenceStats: SentenceStat[] = sentences.map((s, index) => ({
    text: s,
    words: splitWords(s).length,
    index,
  }));

  const words = splitWords(text);
  const syllableCounts = words.map(countSyllables);
  const syllables = syllableCounts.reduce((a, b) => a + b, 0);
  const polysyllables = syllableCounts.filter((n) => n >= 3).length;

  const sentenceCount = Math.max(1, sentenceStats.length);
  const wordCount = Math.max(1, words.length);

  const fleschKincaidGrade =
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllables / wordCount) - 15.59;
  const smog = 1.043 * Math.sqrt(polysyllables * (30 / sentenceCount)) + 3.1291;

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    words: words.length,
    sentences: sentenceStats.length,
    syllables,
    polysyllables,
    fleschKincaidGrade: round1(fleschKincaidGrade),
    smog: round1(smog),
    gradeLevel: round1(Math.max(fleschKincaidGrade, smog)),
    meanWordsPerSentence: round1(wordCount / sentenceCount),
    maxWordsPerSentence: sentenceStats.reduce((m, s) => Math.max(m, s.words), 0),
    sentencesOver15: sentenceStats.filter((s) => s.words > 15).length,
    sentencesOver20: sentenceStats.filter((s) => s.words > 20).length,
    longestSentences: [...sentenceStats].sort((a, b) => b.words - a.words).slice(0, 5),
  };
}

/** Split on markdown headings so RL-01's per-section ceiling can be applied. */
export function splitSections(text: string): { heading: string; body: string }[] {
  const lines = text.split("\n");
  const sections: { heading: string; body: string }[] = [];
  let heading = "(document opening)";
  let body: string[] = [];

  for (const line of lines) {
    const match = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (match) {
      if (body.join("\n").trim()) sections.push({ heading, body: body.join("\n").trim() });
      heading = match[2].trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  if (body.join("\n").trim()) sections.push({ heading, body: body.join("\n").trim() });
  return sections;
}
