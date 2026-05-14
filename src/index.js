#!/usr/bin/env node

/**
 * TouchPoints Swagger MCP Server
 *
 * An MCP server that authenticates with username/password to the TouchPoints
 * API documentation portal, then exposes tools for browsing controllers,
 * models, enums, workflows, and executing API calls.
 *
 * Protocol (discovered from Swagger UI source):
 *   Auth:   POST /lcapi/tpsSupport/C1028/post  →  {"vars.action":"login",...}
 *   Header: X-TP-Auth: <token>
 *   Data:   POST to C1020-C1029 endpoints with vars.-prefixed JSON payloads
 *
 * Usage:
 *   node src/index.js --swagger-url=<base-url>
 *
 * Environment variables:
 *   SWAGGER_USERNAME - Username for authentication
 *   SWAGGER_PASSWORD - Password for authentication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { initAuth } from './auth.js';
import { toolDefinitions, handleToolCall } from './tools.js';

// Parse CLI arguments
function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      args[key] = valueParts.join('=') || true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const swaggerUrl = args['swagger-url'];

if (!swaggerUrl) {
  console.error('Error: --swagger-url is required');
  console.error('Usage: node src/index.js --swagger-url=<base-url>');
  process.exit(1);
}

const username = process.env.SWAGGER_USERNAME;
const password = process.env.SWAGGER_PASSWORD;

if (!username || !password) {
  console.error('Error: SWAGGER_USERNAME and SWAGGER_PASSWORD environment variables are required');
  process.exit(1);
}

// Initialize auth module
initAuth({ baseUrl: swaggerUrl, username, password });

// Create MCP server
const server = new Server(
  {
    name: 'swagger-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolDefinitions };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs } = request.params;
  return handleToolCall(name, toolArgs || {});
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
