import type {
  OpenAPIDocument,
  OperationInfo,
  ResolvedParameter,
  RequestBodyInfo,
  ParameterSchemaInfo,
} from "./types.js";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

/** Characters not allowed in MCP tool names. */
const TOOL_NAME_SANITIZE = /[^a-zA-Z0-9_-]/g;
const TOOL_NAME_MAX_LENGTH = 64;

/**
 * Sanitizes a string so it is a valid MCP tool name:
 * must match /^[a-zA-Z0-9_-]{1,64}$/.
 */
export function sanitizeToolName(name: string): string {
  const sanitized = name.replace(TOOL_NAME_SANITIZE, "_");
  return sanitized.slice(0, TOOL_NAME_MAX_LENGTH) || "unknown_operation";
}

/**
 * Extracts a ParameterSchemaInfo from an OpenAPI schema object.
 */
function extractSchemaInfo(schema: Record<string, unknown>): ParameterSchemaInfo {
  const type = (schema.type as string) || "string";
  const info: ParameterSchemaInfo = { type };

  if (schema.format) info.format = schema.format as string;
  if (Array.isArray(schema.enum)) info.enum = schema.enum;

  if (schema.items && typeof schema.items === "object") {
    info.items = extractSchemaInfo(schema.items as Record<string, unknown>);
  }

  if (schema.properties && typeof schema.properties === "object") {
    info.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      if (val && typeof val === "object") {
        info.properties[key] = extractSchemaInfo(val as Record<string, unknown>);
      }
    }
  }

  return info;
}

/**
 * Extracts parameters from an OpenAPI operation.
 */
function extractParameters(
  rawParams: unknown[],
): ResolvedParameter[] {
  const result: ResolvedParameter[] = [];

  for (const param of rawParams) {
    if (!param || typeof param !== "object") continue;
    const p = param as Record<string, unknown>;

    const name = (p.name as string) || "";
    const location = (p.in as string) || "query";

    if (!["path", "query", "header", "cookie"].includes(location)) continue;

    const required = location === "path" ? true : Boolean(p.required);
    const description = (p.description as string) || "";

    // OpenAPI 2.0 has schema properties directly on the param;
    // OpenAPI 3.x wraps them in a `schema` sub-object.
    const rawSchema =
      p.schema && typeof p.schema === "object"
        ? (p.schema as Record<string, unknown>)
        : p;

    result.push({
      name,
      in: location as ResolvedParameter["in"],
      required,
      description,
      schema: extractSchemaInfo(rawSchema),
    });
  }

  return result;
}

/**
 * Extracts request body info from an OpenAPI 3.x requestBody object or an
 * OpenAPI 2.0 body parameter.
 */
function extractRequestBody(
  operation: Record<string, unknown>,
): { body: RequestBodyInfo | undefined; contentType: string | undefined } {
  // OpenAPI 3.x requestBody
  const requestBody = operation.requestBody;
  if (requestBody && typeof requestBody === "object") {
    const rb = requestBody as Record<string, unknown>;
    const required = Boolean(rb.required);
    const description = (rb.description as string) || "";
    const content = rb.content as Record<string, unknown> | undefined;
    if (content) {
      for (const [contentType, media] of Object.entries(content)) {
        const m = media as Record<string, unknown>;
        if (m.schema && typeof m.schema === "object") {
          return {
            body: {
              required,
              description,
              schema: extractSchemaInfo(m.schema as Record<string, unknown>),
            },
            contentType,
          };
        }
      }
    }
  }

  // OpenAPI 2.0 body parameter
  const params = operation.parameters;
  if (Array.isArray(params)) {
    for (const param of params) {
      if (
        param &&
        typeof param === "object" &&
        (param as Record<string, unknown>).in === "body"
      ) {
        const p = param as Record<string, unknown>;
        const schema = p.schema as Record<string, unknown> | undefined;
        return {
          body: {
            required: Boolean(p.required),
            description: (p.description as string) || "",
            schema: schema ? extractSchemaInfo(schema) : { type: "object" },
          },
          contentType: "application/json",
        };
      }
    }
  }

  return { body: undefined, contentType: undefined };
}

/**
 * Transforms an OpenAPI document into a list of OperationInfo objects,
 * one per HTTP operation found in the spec.
 */
export function transformOperations(spec: OpenAPIDocument): OperationInfo[] {
  const operations: OperationInfo[] = [];
  const seen = new Set<string>();
  const paths = (spec as unknown as Record<string, unknown>).paths;

  if (!paths || typeof paths !== "object") return operations;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const item = pathItem as Record<string, unknown>;

    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation || typeof operation !== "object") continue;
      const op = operation as Record<string, unknown>;

      const rawId = (op.operationId as string) || `${method}_${path}`;
      const operationId = sanitizeToolName(rawId);

      // Deduplicate: if the same operationId appears twice, append a counter.
      let uniqueId = operationId;
      let counter = 1;
      while (seen.has(uniqueId)) {
        uniqueId = `${operationId}_${counter++}`;
      }
      seen.add(uniqueId);

      // Collect parameters (path-level + operation-level, operation wins on name clash).
      const pathLevelParams = Array.isArray(item.parameters)
        ? (item.parameters as unknown[])
        : [];
      const opLevelParams = Array.isArray(op.parameters)
        ? (op.parameters as unknown[])
        : [];
      const allParams = mergeParameters(pathLevelParams, opLevelParams);

      const parameters = extractParameters(allParams).filter(
        (p) => p.in !== "cookie",
      );

      const { body: requestBody, contentType } = extractRequestBody(op);

      operations.push({
        method,
        path,
        operationId: uniqueId,
        summary: (op.summary as string) || "",
        description: (op.description as string) || (op.summary as string) || "",
        parameters,
        requestBody,
        contentType,
      });
    }
  }

  return operations;
}

/**
 * Merges path-level and operation-level parameters, with operation-level
 * parameters winning on name + location clashes (per the OpenAPI spec).
 */
function mergeParameters(
  pathLevel: unknown[],
  opLevel: unknown[],
): unknown[] {
  const merged = new Map<string, unknown>();

  for (const param of [...pathLevel, ...opLevel]) {
    if (param && typeof param === "object") {
      const p = param as Record<string, unknown>;
      const key = `${p.in ?? ""}::${p.name ?? ""}`;
      merged.set(key, param);
    }
  }

  return Array.from(merged.values());
}
