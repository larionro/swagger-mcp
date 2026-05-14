# swagger-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that reads a **Swagger / OpenAPI** specification and exposes every API operation as an MCP tool — letting any MCP-capable LLM client call your API directly.

## Features

- Supports **Swagger 2.0** and **OpenAPI 3.x** (JSON or YAML, file or URL)
- One MCP tool per HTTP operation (named by `operationId`)
- Automatically routes parameters to the correct location: path, query, header, or request body
- Overridable base URL and custom request headers
- stdio transport (compatible with Claude Desktop, Cursor, and other MCP clients)

## Installation

```bash
npm install -g swagger-mcp
```

Or run directly without installing:

```bash
npx swagger-mcp --spec https://petstore3.swagger.io/api/v3/openapi.json
```

## Usage

```
swagger-mcp --spec <path-or-url> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--spec <path-or-url>` | **(Required)** Path or URL to the Swagger/OpenAPI spec |
| `--base-url <url>` | Override the base URL from the spec |
| `--header <name:value>` | Add a custom header to all requests (repeatable) |

### Examples

```bash
# From a remote URL
swagger-mcp --spec https://petstore3.swagger.io/api/v3/openapi.json

# From a local file
swagger-mcp --spec ./my-api.yaml

# With base URL override and auth header
swagger-mcp --spec ./api.yaml \
  --base-url https://staging.example.com \
  --header "Authorization:Bearer my-token" \
  --header "X-Api-Version:2"
```

## Claude Desktop integration

Add an entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": [
        "swagger-mcp",
        "--spec", "https://your-api.example.com/openapi.json",
        "--header", "Authorization:Bearer YOUR_TOKEN"
      ]
    }
  }
}
```

## Programmatic usage

```typescript
import { parseSpec } from "swagger-mcp/dist/parser.js";
import { createServer, runStdioServer } from "swagger-mcp/dist/server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Parse spec
const spec = await parseSpec("./my-api.yaml");

// Create MCP server
const server = createServer(spec, {
  baseUrl: "https://api.example.com",
  headers: { "Authorization": "Bearer token" },
});

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

// Or use the convenience helper:
await runStdioServer(spec, { baseUrl: "https://api.example.com" });
```

## How it works

1. **Parse** — The spec is loaded and fully dereferenced using [`@apidevtools/swagger-parser`](https://apitools.dev/swagger-parser/).
2. **Transform** — Every path × method combination becomes an MCP tool. Parameters (path, query, header) and request body fields are mapped to typed Zod schemas.
3. **Execute** — When a tool is called, arguments are routed to the correct HTTP location and the request is dispatched via [axios](https://axios-http.com).
4. **Respond** — The HTTP status line and response body are returned to the LLM as plain text.

## Development

```bash
npm install
npm run build   # compile TypeScript
npm test        # run tests (vitest)
npm run lint    # type-check only
```
