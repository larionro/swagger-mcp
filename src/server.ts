import z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { OpenAPIDocument, ServerOptions } from "./types.js";
import { transformOperations } from "./transformer.js";
import { openApiTypeToZod } from "./schema.js";
import { executeOperation } from "./executor.js";

/**
 * Derives the base URL from the parsed OpenAPI document.
 * Returns an empty string if no base URL can be determined.
 */
export function resolveBaseUrl(spec: OpenAPIDocument): string {
  const raw = spec as unknown as Record<string, unknown>;

  // OpenAPI 3.x
  if (raw.openapi && Array.isArray(raw.servers) && raw.servers.length > 0) {
    const server = raw.servers[0] as Record<string, unknown>;
    return (server.url as string) || "";
  }

  // Swagger 2.0
  if (raw.swagger) {
    const schemes = Array.isArray(raw.schemes)
      ? (raw.schemes as string[])
      : ["https"];
    const scheme = schemes[0] || "https";
    const host = (raw.host as string) || "";
    const basePath = (raw.basePath as string) || "";
    if (host) return `${scheme}://${host}${basePath}`;
  }

  return "";
}

/**
 * Creates and configures an MCP server from a parsed OpenAPI document.
 * Does NOT connect the server; call `server.connect(transport)` yourself.
 */
export function createServer(
  spec: OpenAPIDocument,
  options: ServerOptions = {},
): McpServer {
  const specRaw = spec as unknown as Record<string, unknown>;
  const info = (specRaw.info as Record<string, unknown>) ?? {};
  const name = (info.title as string) || "swagger-mcp";
  const version = (info.version as string) || "1.0.0";

  const server = new McpServer({ name, version });

  const baseUrl = options.baseUrl ?? resolveBaseUrl(spec);
  const globalHeaders = options.headers ?? {};

  const operations = transformOperations(spec);

  for (const operation of operations) {
    const inputShape: Record<string, z.ZodTypeAny> = {};

    // Add a zod field for every non-cookie parameter.
    for (const param of operation.parameters) {
      const zodType = openApiTypeToZod(param.schema, param.description);
      inputShape[param.name] = param.required ? zodType : zodType.optional();
    }

    // Add a "body" field for operations with a request body.
    if (operation.requestBody) {
      const bodyZod = openApiTypeToZod(
        operation.requestBody.schema,
        operation.requestBody.description || "Request body",
      );
      inputShape["body"] = operation.requestBody.required
        ? bodyZod
        : bodyZod.optional();
    }

    const description =
      [operation.summary, operation.description]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1024) || `${operation.method.toUpperCase()} ${operation.path}`;

    server.registerTool(
      operation.operationId,
      {
        description,
        inputSchema: Object.keys(inputShape).length > 0 ? inputShape : undefined,
      },
      async (args) => {
        try {
          const result = await executeOperation(
            operation,
            (args ?? {}) as Record<string, unknown>,
            baseUrl,
            globalHeaders,
          );
          return {
            content: [{ type: "text" as const, text: result }],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

/**
 * Creates an MCP server and connects it to stdin/stdout.
 * This is the standard entry point for use with Claude Desktop, etc.
 */
export async function runStdioServer(
  spec: OpenAPIDocument,
  options: ServerOptions = {},
): Promise<void> {
  const server = createServer(spec, options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
