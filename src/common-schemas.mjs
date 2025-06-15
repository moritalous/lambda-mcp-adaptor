/**
 * Common Zod Schemas
 *
 * Pre-defined schemas for common use cases
 */

import { z } from 'zod';

/**
 * Common schema patterns for MCP tools
 */
export const CommonSchemas = {
  // Basic types
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),

  // Optional types
  optionalString: z.string().optional(),
  optionalNumber: z.number().optional(),
  optionalBoolean: z.boolean().optional(),

  // Common patterns
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),

  // Utility functions
  enum: (values) => z.enum(values),
  array: (itemSchema) => z.array(itemSchema),
  object: (shape) => z.object(shape),
};
