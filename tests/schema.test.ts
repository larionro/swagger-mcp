import { describe, it, expect } from "vitest";
import z from "zod";
import { openApiTypeToZod } from "../src/schema.js";

describe("openApiTypeToZod", () => {
  it("maps string type", () => {
    const schema = openApiTypeToZod({ type: "string" });
    expect(schema).toBeInstanceOf(z.ZodString);
    expect(schema.safeParse("hello").success).toBe(true);
    expect(schema.safeParse(123).success).toBe(false);
  });

  it("maps integer type", () => {
    const schema = openApiTypeToZod({ type: "integer" });
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse(3.14).success).toBe(false);
    expect(schema.safeParse("hello").success).toBe(false);
  });

  it("maps number type", () => {
    const schema = openApiTypeToZod({ type: "number" });
    expect(schema.safeParse(3.14).success).toBe(true);
    expect(schema.safeParse("hello").success).toBe(false);
  });

  it("maps boolean type", () => {
    const schema = openApiTypeToZod({ type: "boolean" });
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse("true").success).toBe(false);
  });

  it("maps array type", () => {
    const schema = openApiTypeToZod({ type: "array", items: { type: "string" } });
    expect(schema.safeParse(["a", "b"]).success).toBe(true);
    expect(schema.safeParse("not-an-array").success).toBe(false);
  });

  it("maps array type without items", () => {
    const schema = openApiTypeToZod({ type: "array" });
    expect(schema.safeParse([1, "two", true]).success).toBe(true);
  });

  it("maps object type with properties", () => {
    const schema = openApiTypeToZod({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    });
    expect(schema.safeParse({ name: "Alice", age: 30 }).success).toBe(true);
  });

  it("maps object type without properties", () => {
    const schema = openApiTypeToZod({ type: "object" });
    expect(schema.safeParse({ any: "thing" }).success).toBe(true);
  });

  it("maps enum type", () => {
    const schema = openApiTypeToZod({
      type: "string",
      enum: ["cat", "dog", "fish"],
    });
    expect(schema.safeParse("cat").success).toBe(true);
    expect(schema.safeParse("elephant").success).toBe(false);
  });

  it("attaches description when provided", () => {
    const schema = openApiTypeToZod({ type: "string" }, "A user's name");
    expect(schema.description).toBe("A user's name");
  });

  it("defaults unknown types to string", () => {
    const schema = openApiTypeToZod({ type: "binary" as string });
    expect(schema.safeParse("somebinarydata").success).toBe(true);
  });
});
