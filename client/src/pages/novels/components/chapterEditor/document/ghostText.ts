/**
 * Ghost text (inline continuation suggestion) helpers.
 *
 * The suggestion comes from the existing cursor-continuation endpoint; these
 * pure helpers decide when a suggestion may be requested and how much of the
 * returned candidate is shown inline, so the behaviour stays testable
 * without a DOM.
 */

const SENTENCE_ENDINGS = ["。", "！", "？", "…", "；"];

/**
 * True when the caret sits at the end of a non-empty paragraph: the offset
 * is the text end or is followed by a paragraph break, and the paragraph
 * holds at least one non-whitespace character before the caret.
 */
export function isParagraphEndOffset(text: string, offset: number): boolean {
  if (offset < 0 || offset > text.length) {
    return false;
  }
  const next = text[offset];
  if (next !== undefined && next !== "\n") {
    return false;
  }
  const paragraphStart = text.lastIndexOf("\n", offset - 1) + 1;
  return text.slice(paragraphStart, offset).trim().length > 0;
}

/**
 * Reduce a continuation candidate to a short inline suggestion: leading
 * blank space stripped, cut at the first sentence ending (the terminator
 * itself is kept), hard-capped so the grey text never runs away.
 */
export function extractGhostSuggestion(candidate: string, maxChars = 42): string {
  const cleaned = candidate.replace(/^\s+/, "");
  if (!cleaned) {
    return "";
  }
  let cut = cleaned.length;
  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (char === "\n") {
      cut = index;
      break;
    }
    if (SENTENCE_ENDINGS.includes(char)) {
      cut = index + 1;
      break;
    }
  }
  const sentence = cleaned.slice(0, cut).trimEnd();
  if (sentence.length <= maxChars) {
    return sentence;
  }
  return sentence.slice(0, maxChars);
}
