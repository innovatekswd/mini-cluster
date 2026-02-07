import { describe, it, expect } from "vitest";
import {
  createAppSchema,
  createServiceSchema,
  serviceConfigSchema,
  loginSchema,
  registerSchema,
  variableSchema,
  environmentSchema,
} from "./validation";

describe("createAppSchema", () => {
  it("accepts valid app data", () => {
    const result = createAppSchema.safeParse({
      name: "My App",
      description: "A test app",
      icon: "🚀",
      color: "#ff5733",
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = createAppSchema.safeParse({
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = createAppSchema.safeParse({
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("provides default icon and color", () => {
    const result = createAppSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.icon).toBe("📦");
      expect(result.data.color).toBe("#3b82f6");
    }
  });

  it("rejects invalid hex color", () => {
    const result = createAppSchema.safeParse({
      name: "Test",
      color: "not-a-color",
    });
    expect(result.success).toBe(false);
  });
});

describe("serviceConfigSchema", () => {
  it("accepts valid service config", () => {
    const result = serviceConfigSchema.safeParse({
      name: "API Server",
      executablePath: "/usr/bin/node",
      arguments: "server.js",
      autoStart: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires name and executablePath", () => {
    const result = serviceConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("provides boolean defaults", () => {
    const result = serviceConfigSchema.safeParse({
      name: "Test",
      executablePath: "/bin/test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isExternal).toBe(false);
      expect(result.data.useShellExecute).toBe(false);
      expect(result.data.createNoWindow).toBe(true);
      expect(result.data.autoStart).toBe(false);
    }
  });
});

describe("createServiceSchema", () => {
  it("accepts optional appId as valid UUID", () => {
    const result = createServiceSchema.safeParse({
      name: "Test",
      executablePath: "/bin/test",
      appId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for appId", () => {
    const result = createServiceSchema.safeParse({
      name: "Test",
      executablePath: "/bin/test",
      appId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "password",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = loginSchema.safeParse({
      username: "ab",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      username: "newuser",
      email: "user@example.com",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      username: "newuser",
      email: "user@example.com",
      password: "Password1",
      confirmPassword: "Password2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({
      username: "newuser",
      email: "user@example.com",
      password: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = registerSchema.safeParse({
      username: "newuser",
      email: "user@example.com",
      password: "Password",
      confirmPassword: "Password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid username characters", () => {
    const result = registerSchema.safeParse({
      username: "user@name",
      email: "user@example.com",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(false);
  });
});

describe("variableSchema", () => {
  it("accepts valid variable name", () => {
    const result = variableSchema.safeParse({
      key: "MY_VAR",
      value: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects variable name starting with number", () => {
    const result = variableSchema.safeParse({
      key: "1BAD",
      value: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("accepts underscore-prefixed names", () => {
    const result = variableSchema.safeParse({
      key: "_PRIVATE",
    });
    expect(result.success).toBe(true);
  });
});

describe("environmentSchema", () => {
  it("accepts valid environment", () => {
    const result = environmentSchema.safeParse({
      name: "production",
      variables: { DB_HOST: "localhost", DB_PORT: "5432" },
    });
    expect(result.success).toBe(true);
  });

  it("defaults variables to empty object", () => {
    const result = environmentSchema.safeParse({
      name: "staging",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual({});
    }
  });
});
