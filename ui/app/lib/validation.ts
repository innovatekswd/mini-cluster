/**
 * Zod validation schemas for forms
 * 
 * These schemas provide:
 * 1. Runtime type validation
 * 2. Type inference for TypeScript
 * 3. Detailed error messages
 * 4. Reusable validation across forms
 * 
 * Usage:
 * ```tsx
 * import { appSchema, type AppFormData } from '~/lib/validation';
 * 
 * const result = appSchema.safeParse(formData);
 * if (!result.success) {
 *   // Handle errors
 *   console.log(result.error.format());
 * }
 * ```
 */

import { z } from "zod";

// Common validations
const nonEmptyString = z.string().min(1, "This field is required");
const optionalString = z.string().optional();
const url = z.string().url("Must be a valid URL").or(z.literal("")).optional();

// ============================================================
// App Schemas
// ============================================================

export const createAppSchema = z.object({
  name: nonEmptyString.max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  icon: z.string().emoji("Must be a valid emoji").optional().default("📦"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().default("#3b82f6"),
});

export const updateAppSchema = createAppSchema.partial();

export type CreateAppFormData = z.infer<typeof createAppSchema>;
export type UpdateAppFormData = z.infer<typeof updateAppSchema>;

// ============================================================
// Service Schemas
// ============================================================

export const serviceConfigSchema = z.object({
  name: nonEmptyString.max(100, "Name must be 100 characters or less"),
  executablePath: nonEmptyString.max(500, "Path must be 500 characters or less"),
  arguments: z.string().max(1000, "Arguments must be 1000 characters or less").optional(),
  workingDirectory: z.string().max(500, "Path must be 500 characters or less").optional(),
  environmentVariables: z.record(z.string(), z.string()).optional().default({}),
  accessLink: url,
  isExternal: z.boolean().default(false),
  useShellExecute: z.boolean().default(false),
  createNoWindow: z.boolean().default(true),
  autoStart: z.boolean().default(false),
});

export const createServiceSchema = serviceConfigSchema.extend({
  appId: z.string().uuid("Invalid app ID").optional(),
  machineId: z.string().uuid("Invalid machine ID").optional(),
});

export type ServiceConfigFormData = z.infer<typeof serviceConfigSchema>;
export type CreateServiceFormData = z.infer<typeof createServiceSchema>;

// ============================================================
// Environment Schemas
// ============================================================

export const variableSchema = z.object({
  key: nonEmptyString.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Must be a valid variable name"),
  value: z.string().optional(),
  isSecret: z.boolean().default(false),
});

export const environmentSchema = z.object({
  name: nonEmptyString.max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  variables: z.record(z.string(), z.string()).default({}),
});

export type VariableFormData = z.infer<typeof variableSchema>;
export type EnvironmentFormData = z.infer<typeof environmentSchema>;

// ============================================================
// Auth Schemas
// ============================================================

export const loginSchema = z.object({
  username: nonEmptyString.min(3, "Username must be at least 3 characters"),
  password: nonEmptyString.min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: nonEmptyString
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be 50 characters or less")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  email: z.string().email("Must be a valid email address"),
  password: nonEmptyString
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: nonEmptyString,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

// ============================================================
// Machine Schemas
// ============================================================

export const createMachineSchema = z.object({
  name: nonEmptyString.max(100, "Name must be 100 characters or less"),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  connectionType: z.enum(["local", "ssh", "agent"]).default("local"),
  sshUsername: z.string().optional(),
  sshKeyPath: z.string().optional(),
});

export type CreateMachineFormData = z.infer<typeof createMachineSchema>;

// ============================================================
// File Schemas
// ============================================================

export const createFileSchema = z.object({
  name: nonEmptyString
    .max(255, "Name must be 255 characters or less")
    .regex(/^[^<>:"/\\|?*]+$/, "Name contains invalid characters"),
  filePath: nonEmptyString.max(1000, "Path must be 1000 characters or less"),
  content: z.string().optional(),
});

export type CreateFileFormData = z.infer<typeof createFileSchema>;

// ============================================================
// Proxy Route Schemas
// ============================================================

export const proxyRouteSchema = z.object({
  path: nonEmptyString.regex(/^\//, "Path must start with /"),
  targetUrl: z.string().url("Must be a valid URL"),
  isEnabled: z.boolean().default(true),
  stripPath: z.boolean().default(false),
  preserveHost: z.boolean().default(false),
});

export type ProxyRouteFormData = z.infer<typeof proxyRouteSchema>;

// ============================================================
// Validation Helper Functions
// ============================================================

/**
 * Validates form data and returns formatted errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  
  return { success: false, errors };
}

/**
 * Hook-friendly validation that returns field errors
 */
export function getFieldError(
  errors: Record<string, string> | undefined,
  field: string
): string | undefined {
  return errors?.[field];
}
