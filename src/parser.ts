import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIDocument } from "./types.js";

/**
 * Parses and fully dereferences a Swagger/OpenAPI specification.
 * Accepts a file path (absolute or relative) or a URL.
 */
export async function parseSpec(specPathOrUrl: string): Promise<OpenAPIDocument> {
  const api = await SwaggerParser.dereference(specPathOrUrl);
  return api as OpenAPIDocument;
}
