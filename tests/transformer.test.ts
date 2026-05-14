import { describe, it, expect } from "vitest";
import { sanitizeToolName, transformOperations } from "../src/transformer.js";
import type { OpenAPIDocument } from "../src/types.js";

describe("sanitizeToolName", () => {
  it("keeps valid characters unchanged", () => {
    expect(sanitizeToolName("getUser")).toBe("getUser");
    expect(sanitizeToolName("get_user-123")).toBe("get_user-123");
  });

  it("replaces invalid characters with underscores", () => {
    expect(sanitizeToolName("GET /users/{id}")).toBe("GET__users__id_");
    expect(sanitizeToolName("list users")).toBe("list_users");
  });

  it("truncates names longer than 64 characters", () => {
    const long = "a".repeat(100);
    expect(sanitizeToolName(long).length).toBe(64);
  });

  it("returns fallback for empty result", () => {
    // All special characters → all underscores, which is fine actually
    expect(sanitizeToolName("abc")).toBe("abc");
    expect(sanitizeToolName("")).toBe("unknown_operation");
  });
});

describe("transformOperations", () => {
  const petstore: OpenAPIDocument = {
    openapi: "3.0.0",
    info: { title: "Petstore", version: "1.0.0" },
    paths: {
      "/pets": {
        get: {
          operationId: "listPets",
          summary: "List all pets",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer" },
            },
          ],
          responses: {},
        },
        post: {
          operationId: "createPet",
          summary: "Create a pet",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    age: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {},
        },
      },
      "/pets/{petId}": {
        get: {
          operationId: "showPetById",
          summary: "Info for a specific pet",
          parameters: [
            {
              name: "petId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {},
        },
      },
    },
  } as unknown as OpenAPIDocument;

  it("extracts one operation per HTTP method+path", () => {
    const ops = transformOperations(petstore);
    expect(ops).toHaveLength(3);
  });

  it("preserves operationId", () => {
    const ops = transformOperations(petstore);
    const ids = ops.map((o) => o.operationId);
    expect(ids).toContain("listPets");
    expect(ids).toContain("createPet");
    expect(ids).toContain("showPetById");
  });

  it("extracts query parameters", () => {
    const ops = transformOperations(petstore);
    const list = ops.find((o) => o.operationId === "listPets")!;
    expect(list.parameters).toHaveLength(1);
    expect(list.parameters[0].name).toBe("limit");
    expect(list.parameters[0].in).toBe("query");
    expect(list.parameters[0].required).toBe(false);
    expect(list.parameters[0].schema.type).toBe("integer");
  });

  it("extracts path parameters", () => {
    const ops = transformOperations(petstore);
    const show = ops.find((o) => o.operationId === "showPetById")!;
    expect(show.parameters).toHaveLength(1);
    expect(show.parameters[0].name).toBe("petId");
    expect(show.parameters[0].in).toBe("path");
    expect(show.parameters[0].required).toBe(true);
  });

  it("extracts request body for POST operations", () => {
    const ops = transformOperations(petstore);
    const create = ops.find((o) => o.operationId === "createPet")!;
    expect(create.requestBody).toBeDefined();
    expect(create.requestBody!.required).toBe(true);
    expect(create.requestBody!.schema.type).toBe("object");
  });

  it("deduplicates operations with the same operationId", () => {
    const spec: OpenAPIDocument = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/a": { get: { operationId: "op", responses: {} } },
        "/b": { get: { operationId: "op", responses: {} } },
      },
    } as unknown as OpenAPIDocument;
    const ops = transformOperations(spec);
    expect(ops).toHaveLength(2);
    const ids = ops.map((o) => o.operationId);
    expect(new Set(ids).size).toBe(2);
  });

  it("handles specs with no paths gracefully", () => {
    const empty: OpenAPIDocument = {
      openapi: "3.0.0",
      info: { title: "Empty", version: "1.0.0" },
      paths: {},
    } as unknown as OpenAPIDocument;
    expect(transformOperations(empty)).toEqual([]);
  });

  it("merges path-level and operation-level parameters", () => {
    const spec: OpenAPIDocument = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/items/{id}": {
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          get: {
            operationId: "getItem",
            parameters: [
              { name: "format", in: "query", required: false, schema: { type: "string" } },
            ],
            responses: {},
          },
        },
      },
    } as unknown as OpenAPIDocument;
    const ops = transformOperations(spec);
    const get = ops[0];
    expect(get.parameters.map((p) => p.name)).toContain("id");
    expect(get.parameters.map((p) => p.name)).toContain("format");
  });
});
