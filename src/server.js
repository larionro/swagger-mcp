#!/usr/bin/env node

/**
 * TouchPoints Swagger MCP Server — HTTPS Transport (Cloud Run compatible)
 *
 * Exposes the same MCP tools as the stdio version but over Streamable HTTP(S),
 * allowing VS Code (or any MCP client) to connect remotely.
 *
 * Environment variables:
 *   SWAGGER_URL      - Base URL of the TouchPoints API
 *   SWAGGER_USERNAME - Username for TP authentication
 *   SWAGGER_PASSWORD - Password for TP authentication
 *   MCP_API_KEY      - API key required from MCP clients (Authorization: Bearer <key>)
 *   PORT             - Listen port (default 8080, Cloud Run convention)
 *   TLS_CERT_PATH    - Path to TLS certificate file (optional; enables HTTPS)
 *   TLS_KEY_PATH     - Path to TLS private key file (optional; enables HTTPS)
 */

import express from 'express';
import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { initAuth } from './auth.js';
import { toolDefinitions, handleToolCall } from './tools.js';

// --- Configuration ---
const swaggerUrl = process.env.SWAGGER_URL;
const username = process.env.SWAGGER_USERNAME;
const password = process.env.SWAGGER_PASSWORD;
const apiKey = process.env.MCP_API_KEY;
const port = parseInt(process.env.PORT || '8080', 10);

if (!swaggerUrl) {
  console.error('Error: SWAGGER_URL environment variable is required');
  process.exit(1);
}
if (!username || !password) {
  console.error('Error: SWAGGER_USERNAME and SWAGGER_PASSWORD environment variables are required');
  process.exit(1);
}
if (!apiKey) {
  console.error('Error: MCP_API_KEY environment variable is required (used to authenticate MCP clients)');
  process.exit(1);
}

// Initialize auth module
initAuth({ baseUrl: swaggerUrl, username, password });

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  // Constant-time comparison to prevent timing attacks
  if (token.length !== apiKey.length || !timingSafeEqual(token, apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return cryptoTimingSafeEqual(bufA, bufB);
}

// --- Express app ---
const app = express();

// Health check (unauthenticated — required by Cloud Run)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// MCP endpoint — all MCP traffic goes through /mcp
app.use('/mcp', authMiddleware, async (req, res) => {
  // Create per-session transport and server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = new Server(
    { name: 'swagger-mcp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    return handleToolCall(name, toolArgs || {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// Start listening — HTTPS if certs provided, otherwise plain HTTP (Cloud Run terminates TLS)
const tlsCert = process.env.TLS_CERT_PATH;
const tlsKey = process.env.TLS_KEY_PATH;

let httpServer;
if (tlsCert && tlsKey) {
  const options = {
    cert: readFileSync(tlsCert),
    key: readFileSync(tlsKey),
  };
  httpServer = createHttpsServer(options, app);
  httpServer.listen(port, () => {
    console.log(`Swagger MCP server (HTTPS) listening on port ${port}`);
    console.log(`MCP endpoint: https://localhost:${port}/mcp`);
    console.log(`Health check: https://localhost:${port}/health`);
  });
} else {
  httpServer = createHttpServer(app);
  httpServer.listen(port, () => {
    console.log(`Swagger MCP server (HTTP) listening on port ${port}`);
    console.log(`  (Set TLS_CERT_PATH + TLS_KEY_PATH for native HTTPS)`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}
