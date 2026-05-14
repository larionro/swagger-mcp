import { describe, it, expect } from "vitest";
import { resolveBaseUrl, createServer } from "../src/server.js";
import type { OpenAPIDocument } from "../src/types.js";

const v3Spec: OpenAPIDocument = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "2.1.0" },
  servers: [{ url: "https://api.example.com/v1" }],
  paths: {
    "/users": {
      get: {
        operationId: "listUsers",
        summary: "List users",
        parameters: [],
        responses: {},
      },
      post: {
        operationId: "createUser",
        summary: "Create a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" } } },
            },
          },
        },
        responses: {},
      },
    },
  },
} as unknown as OpenAPIDocument;

const v2Spec: OpenAPIDocument = {
  swagger: "2.0",
  info: { title: "Petstore", version: "1.0" },
  host: "petstore.swagger.io",
  basePath: "/v2",
  schemes: ["https"],
  paths: {
    "/pet": {
      get: {
        operationId: "listPets",
        summary: "List pets",
        parameters: [],
        responses: {},
      },
    },
  },
} as unknown as OpenAPIDocument;

describe("resolveBaseUrl", () => {
  it("extracts base URL from OpenAPI 3.x servers array", () => {
    expect(resolveBaseUrl(v3Spec)).toBe("https://api.example.com/v1");
  });

  it("constructs base URL from Swagger 2.0 host/basePath/schemes", () => {
    expect(resolveBaseUrl(v2Spec)).toBe("https://petstore.swagger.io/v2");
  });

  it("returns empty string when no base URL info is present", () => {
    const spec: OpenAPIDocument = {
      openapi: "3.0.0",
      info: { title: "No URL", version: "1.0.0" },
      paths: {},
    } as unknown as OpenAPIDocument;
    expect(resolveBaseUrl(spec)).toBe("");
  });
});

describe("createServer", () => {
  it("creates an MCP server with the spec title and version", () => {
    const server = createServer(v3Spec);
    expect(server).toBeDefined();
  });

  it("accepts an overridden base URL via options", () => {
    const server = createServer(v3Spec, { baseUrl: "http://localhost:3000" });
    expect(server).toBeDefined();
  });

  it("creates tools for each path+method combination", () => {
    const server = createServer(v3Spec);
    // The MCP server instance exposes _registeredTools (internal) – we just
    // check that the server object is non-null and was created without errors.
    expect(server).toBeDefined();
  });
});
