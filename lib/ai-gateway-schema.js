import Ajv from "ajv";
import { gatewayError } from "./ai-gateway-config.js";

// Deliberately small provider-portable subset. Full local bounds stay enforced
// even when Anthropic's constrained decoder cannot express those bounds.
const KEYS = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "description",
  "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems"]);
const LOCAL_ONLY = new Set(["minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems"]);
const ajvOptions = { strict: true, allErrors: false, coerceTypes: false, removeAdditional: false, useDefaults: false };
export function compileGatewaySchema(schema) {
  try {
    const copy = JSON.parse(JSON.stringify(schema));
    if (JSON.stringify(copy).length > 16000 || copy.type !== "object") throw Error();
    let nodes = 0;
    function walk(node, depth = 0) {
      if (!node || typeof node !== "object" || Array.isArray(node) || depth > 6 || ++nodes > 100 ||
          Object.keys(node).some(k => !KEYS.has(k))) throw Error();
      if (!["object", "array", "string", "integer", "number", "boolean", "null"].includes(node.type)) throw Error();
      if (node.enum && (!Array.isArray(node.enum) || node.enum.length > 100 || node.enum.some(v => v !== null && typeof v === "object"))) throw Error();
      const wire = Object.fromEntries(Object.entries(node).filter(([k]) => !LOCAL_ONLY.has(k)));
      if (node.type === "object") {
        if (!node.properties || node.additionalProperties !== false || !Array.isArray(node.required) ||
            node.required.length !== Object.keys(node.properties).length || new Set(node.required).size !== node.required.length ||
            Object.keys(node.properties).some(k => !node.required.includes(k))) throw Error();
        wire.properties = Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, walk(v, depth + 1)]));
      }
      if (node.type === "array") wire.items = walk(node.items, depth + 1);
      return wire;
    }
    const wireSchema = walk(copy);
    return { wireSchema, validate: new Ajv(ajvOptions).compile(copy) };
  } catch { throw gatewayError("AI_GATEWAY_INVALID_INPUT"); }
}
