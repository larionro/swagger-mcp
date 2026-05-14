#!/usr/bin/env node
import { Command } from "commander";
import { parseSpec } from "./parser.js";
import { runStdioServer } from "./server.js";

const program = new Command();

program
  .name("swagger-mcp")
  .description(
    "Start an MCP server that exposes a Swagger/OpenAPI spec as tools",
  )
  .version("1.0.0")
  .requiredOption(
    "--spec <path-or-url>",
    "Path or URL to the Swagger/OpenAPI specification file",
  )
  .option(
    "--base-url <url>",
    "Override the base URL defined in the specification",
  )
  .option(
    "--header <name:value>",
    "Add a custom HTTP header to all outgoing requests (can be repeated)",
    (value: string, previous: string[]) => {
      previous.push(value);
      return previous;
    },
    [] as string[],
  )
  .action(async (opts: { spec: string; baseUrl?: string; header: string[] }) => {
    const headers: Record<string, string> = {};
    for (const h of opts.header) {
      const idx = h.indexOf(":");
      if (idx === -1) {
        console.error(`Warning: ignoring malformed header "${h}" (missing ':')`);
        continue;
      }
      const name = h.slice(0, idx).trim();
      const value = h.slice(idx + 1).trim();
      headers[name] = value;
    }

    try {
      const spec = await parseSpec(opts.spec);
      await runStdioServer(spec, {
        baseUrl: opts.baseUrl,
        headers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to start server: ${message}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
});
