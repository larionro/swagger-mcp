import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export type OpenAPIDocument =
  | OpenAPIV2.Document
  | OpenAPIV3.Document
  | OpenAPIV3_1.Document;

export type OpenAPIOperation =
  | OpenAPIV2.OperationObject
  | OpenAPIV3.OperationObject
  | OpenAPIV3_1.OperationObject;

export type OpenAPIParameter =
  | OpenAPIV2.Parameter
  | OpenAPIV3.ParameterObject
  | OpenAPIV3_1.ParameterObject;

export type OpenAPISchema =
  | OpenAPIV2.SchemaObject
  | OpenAPIV3.SchemaObject
  | OpenAPIV3_1.SchemaObject;

/** Resolved info about a single HTTP operation from the spec. */
export interface OperationInfo {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  parameters: ResolvedParameter[];
  requestBody?: RequestBodyInfo;
  contentType?: string;
}

export interface ResolvedParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  description: string;
  schema: ParameterSchemaInfo;
}

export interface ParameterSchemaInfo {
  type: string;
  format?: string;
  enum?: unknown[];
  items?: ParameterSchemaInfo;
  properties?: Record<string, ParameterSchemaInfo>;
}

export interface RequestBodyInfo {
  required: boolean;
  description: string;
  schema: ParameterSchemaInfo;
}

export interface ServerOptions {
  /** Override the base URL from the spec. */
  baseUrl?: string;
  /** Custom HTTP headers added to every outgoing request. */
  headers?: Record<string, string>;
}
