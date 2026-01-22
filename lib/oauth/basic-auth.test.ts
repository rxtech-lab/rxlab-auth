import { describe, it, expect } from "bun:test";
import { parseBasicAuth } from "./basic-auth";

describe("parseBasicAuth", () => {
  it("should parse valid Basic auth header", () => {
    // "client123:secret456" encoded in base64
    const encoded = Buffer.from("client123:secret456").toString("base64");
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toEqual({
      clientId: "client123",
      clientSecret: "secret456",
    });
  });

  it("should handle empty client secret", () => {
    // "client123:" encoded in base64 (empty secret)
    const encoded = Buffer.from("client123:").toString("base64");
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toEqual({
      clientId: "client123",
      clientSecret: "",
    });
  });

  it("should handle client secret with colons", () => {
    // "client123:secret:with:colons" encoded in base64
    const encoded = Buffer.from("client123:secret:with:colons").toString(
      "base64",
    );
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toEqual({
      clientId: "client123",
      clientSecret: "secret:with:colons",
    });
  });

  it("should return null for null header", () => {
    const result = parseBasicAuth(null);
    expect(result).toBeNull();
  });

  it("should return null for non-Basic auth header", () => {
    const result = parseBasicAuth("Bearer sometoken");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parseBasicAuth("");
    expect(result).toBeNull();
  });

  it("should return null for credentials without colon", () => {
    const encoded = Buffer.from("justclientid").toString("base64");
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toBeNull();
  });

  it("should return null for empty client id", () => {
    // ":secretonly" encoded in base64 (empty clientId)
    const encoded = Buffer.from(":secretonly").toString("base64");
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toBeNull();
  });

  it("should handle special characters in credentials", () => {
    const encoded = Buffer.from("client@example.com:p@$$w0rd!").toString(
      "base64",
    );
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toEqual({
      clientId: "client@example.com",
      clientSecret: "p@$$w0rd!",
    });
  });

  it("should handle URL-encoded credentials", () => {
    // Some clients URL-encode the credentials before base64 encoding
    const encoded = Buffer.from(
      "client%40example.com:secret%3Dvalue",
    ).toString("base64");
    const header = `Basic ${encoded}`;

    const result = parseBasicAuth(header);

    expect(result).toEqual({
      clientId: "client%40example.com",
      clientSecret: "secret%3Dvalue",
    });
  });
});
