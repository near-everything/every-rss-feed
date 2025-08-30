import {
  createConfigSchema,
  createInputSchema,
  createOutputSchema,
  z,
} from "every-plugin";
import { FeedItem } from "../../../../apps/server/src/schemas/feed";

// Config schema with variables and secrets
export const RssConfigSchema = createConfigSchema(
  // Variables (non-sensitive config)
  z.object({
    baseUrl: z.url().default("http://localhost:1337"),
    timeout: z.number().default(30000),
  }),
  // Secrets (sensitive config, hydrated at runtime)
  z.object({
    apiKey: z.string().min(1, "API key is required"),
  }),
);

// Input schema for add item to feed workflow
export const RssInputSchema = createInputSchema(
  z.object({
    feedId: z.string().min(1, "Feed ID is required"),
    item: FeedItem,
  }),
);

// Output schema
export const RssOutputSchema = createOutputSchema(
  z.object({
    success: z.boolean(),
    itemId: z.string(),
    message: z.string().optional(),
  }),
);

// Derived types
export type RssConfig = z.infer<typeof RssConfigSchema>;
export type RssInput = z.infer<typeof RssInputSchema>;
export type RssOutput = z.infer<typeof RssOutputSchema>;
