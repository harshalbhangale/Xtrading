import { describe, expect, it } from "vitest";
import { databaseOptions } from "./client";

describe("database connection boundary", () => {
  it("allows local development without TLS", () => {
    expect(
      databaseOptions("postgresql://cmb:local@127.0.0.1:5433/cmb").options.ssl,
    ).toBe(false);
  });
  it("rejects remote TLS downgrade and non-Postgres URLs", () => {
    for (const url of [
      "postgresql://user:secret@db.example.com/cmb",
      "postgresql://user:secret@db.example.com/cmb?sslmode=require",
      "https://db.example.com/cmb",
    ])
      expect(() => databaseOptions(url)).toThrow();
  });
  it("requires certificate verification remotely without returning secrets in errors", () => {
    const result = databaseOptions(
      "postgresql://user:secret@db.example.com/cmb?sslmode=verify-full",
    );
    expect(result.options.ssl).toEqual({ rejectUnauthorized: true });
    expect(result.url).not.toContain("sslmode");
    expect(result.options.max).toBe(5);
  });
});
