import z from "zod";
import type { ParameterSchemaInfo } from "./types.js";

/**
 * Converts an OpenAPI parameter/schema type into a Zod schema.
 */
export function openApiTypeToZod(
  schema: ParameterSchemaInfo,
  description?: string,
): z.ZodTypeAny {
  let base: z.ZodTypeAny;

  switch (schema.type) {
    case "integer":
      base = z.number().int();
      break;
    case "number":
      base = z.number();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "array":
      base = z.array(
        schema.items ? openApiTypeToZod(schema.items) : z.unknown(),
      );
      break;
    case "object":
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, val] of Object.entries(schema.properties)) {
          shape[key] = openApiTypeToZod(val);
        }
        base = z.object(shape).passthrough();
      } else {
        base = z.record(z.string(), z.unknown());
      }
      break;
    default:
      if (schema.enum && schema.enum.length > 0) {
        const values = schema.enum.map(String);
        base = z.enum(values as [string, ...string[]]);
      } else {
        base = z.string();
      }
  }

  if (description) {
    base = base.describe(description);
  }

  return base;
}
