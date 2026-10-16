// Diagnostic-only mirror of lib/reflection-v2.js guards, in the same order.
// Call only AFTER the authoritative validator throws. Never accepts, repairs or
// logs output. Keep rejection parity covered when the frozen validator changes.
import { REFLECTION_V2_SCHEMAS } from "../lib/reflection-v2.js";
import { compileGatewaySchema } from "../lib/ai-gateway-schema.js";
import { REPORT_NARRATIVE_LIMITS } from "../lib/report-narrative.js";

const names = ["SCHEMA_REQUIRED", "SCHEMA_ADDITIONAL_PROPERTY", "SCHEMA_TYPE", "SCHEMA_ENUM",
  "SCHEMA_MIN_ITEMS", "SCHEMA_MAX_ITEMS", "SCHEMA_MIN_LENGTH", "SCHEMA_MAX_LENGTH", "SCHEMA_INVALID",
  "VERSION_MISMATCH", "LOCALE_UNSUPPORTED", "REF_OUT_OF_RANGE", "LOCALE_MISMATCH", "EMPTY_SENTENCE",
  "REFS_DUPLICATE", "REF_NOT_SUPPLIED", "CONTROL_CHARACTER", "ALIAS_IN_TEXT", "URL_IN_TEXT", "MARKUP_PREFIX",
  "PREVIOUS_ONLY_SENTENCE", "DIGIT_UNSUPPORTED", "QUOTE_EMPTY", "QUOTE_UNSUPPORTED", "PARAGRAPH_TOO_LONG",
  "WEEKLY_EVENT_COVERAGE", "MONTHLY_WEEK_COVERAGE", "NARRATIVE_TOO_LONG", "UNKNOWN"];
export const REFLECTION_V2_VALIDATION_CODES = Object.freeze(Object.fromEntries(names.map(name => [name, `REFLECTION_V2_${name}`])));
const C = REFLECTION_V2_VALIDATION_CODES;
const compiled = Object.fromEntries(Object.entries(REFLECTION_V2_SCHEMAS).map(([type, schema]) => [type, compileGatewaySchema(schema).validate]));
const schemaCodes = Object.freeze({ required: C.SCHEMA_REQUIRED, additionalProperties: C.SCHEMA_ADDITIONAL_PROPERTY,
  type: C.SCHEMA_TYPE, enum: C.SCHEMA_ENUM, minItems: C.SCHEMA_MIN_ITEMS, maxItems: C.SCHEMA_MAX_ITEMS,
  minLength: C.SCHEMA_MIN_LENGTH, maxLength: C.SCHEMA_MAX_LENGTH });
const norm = text => String(text).normalize("NFKC").replace(/\s+/gu, " ").trim();
const DIGITS = /\d+(?:[.,:]\d+)*/gu;
const QUOTES = /“([^”]*)”|「([^」]*)」|『([^』]*)』|"([^"]*)"/gu;

function quoteSupported(quote, sources) {
  return sources.some(source => {
    for (let at = source.text.indexOf(quote); at >= 0; at = source.text.indexOf(quote, at + 1)) {
      const before = source.text.slice(0, at).trimEnd(), after = source.text.slice(at + quote.length).trimStart();
      if ((!before || /\p{P}$/u.test(before)) && (!after || /^\p{P}/u.test(after) || /\p{P}$/u.test(quote)) &&
          at + quote.length <= source.complete) return true;
    }
    return false;
  });
}

export function reflectionV2ValidationCode(output, { type, locale, built }) {
  try {
    const validate = compiled[type];
    if (!validate(output)) {
      // Never return AJV messages, params, instance paths or user-defined keys.
      // These are fixed schema paths, not paths derived from rejected content.
      const error = validate.errors?.[0];
      if (error?.keyword === "enum") {
        if (error.schemaPath === "#/properties/version/enum") return C.VERSION_MISMATCH;
        if (error.schemaPath === "#/properties/locale/enum") return C.LOCALE_UNSUPPORTED;
        if (error.schemaPath === "#/properties/paragraphs/items/properties/sentences/items/properties/refs/items/enum") return C.REF_OUT_OF_RANGE;
      }
      return Object.hasOwn(schemaCodes, error?.keyword) ? schemaCodes[error.keyword] : C.SCHEMA_INVALID;
    }
    if (output.locale !== locale) return C.LOCALE_MISMATCH;
    const limits = REPORT_NARRATIVE_LIMITS[type], cited = new Set(), paragraphs = [];
    for (const paragraph of output.paragraphs) {
      const sentences = [];
      for (const sentence of paragraph.sentences) {
        const text = sentence.text.trim(), refs = sentence.refs, sources = refs.map(ref => built.refs.get(ref));
        if (!text) return C.EMPTY_SENTENCE;
        if (new Set(refs).size !== refs.length) return C.REFS_DUPLICATE;
        if (sources.some(source => !source)) return C.REF_NOT_SUPPLIED;
        if (/[\p{Cc}\p{Cf}]/u.test(text)) return C.CONTROL_CHARACTER;
        if (/\bE\d{1,2}\b/iu.test(text)) return C.ALIAS_IN_TEXT;
        if (/https?:\/\/|www\./iu.test(text)) return C.URL_IN_TEXT;
        if (/^[#*>•-]/u.test(text)) return C.MARKUP_PREFIX;
        if (sources.some(source => source.previous) && sources.every(source => source.previous)) return C.PREVIOUS_ONLY_SENTENCE;
        const normalized = norm(text), supported = new Set(sources.flatMap(source => [...source.digits]));
        if ((normalized.match(DIGITS) || []).some(value => !supported.has(value))) return C.DIGIT_UNSUPPORTED;
        for (const match of normalized.matchAll(QUOTES)) {
          const quote = (match[1] ?? match[2] ?? match[3] ?? match[4]).trim();
          if (!quote) return C.QUOTE_EMPTY;
          if (!quoteSupported(quote, sources)) return C.QUOTE_UNSUPPORTED;
        }
        refs.forEach(ref => cited.add(ref)); sentences.push(text);
      }
      const claim = sentences.join(locale === "en" ? " " : "");
      if (claim.length > limits.maxClaimCharacters) return C.PARAGRAPH_TOO_LONG;
      paragraphs.push(claim);
    }
    const current = [...cited].map(ref => built.refs.get(ref)).filter(source => !source.previous);
    if (type === "WEEKLY" && current.length < 2) return C.WEEKLY_EVENT_COVERAGE;
    if (type === "MONTHLY") {
      const weeks = new Set([...built.refs.values()].filter(source => !source.previous).map(source => source.week));
      if ([...weeks].some(week => !current.some(source => source.week === week))) return C.MONTHLY_WEEK_COVERAGE;
    }
    if (paragraphs.join("\n\n").length > limits.maxNarrativeCharacters) return C.NARRATIVE_TOO_LONG;
  } catch { /* Unknown internal failures must not leak an exception or its cause. */ }
  return C.UNKNOWN;
}
