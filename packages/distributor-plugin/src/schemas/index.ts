import {
  createConfigSchema,
  createInputSchema,
  createOutputSchema,
  z,
} from "every-plugin";
import { FeedItem } from "../../../../apps/server/src/schemas/feed";

// Config schema with configuration-based routing
export const RssDistributorConfigSchema = createConfigSchema(
  // Variables (non-sensitive config)
  z.object({
    baseUrl: z.url().default("http://localhost:1337"),
    timeout: z.number().default(30000),
    // Routing configuration
    distributionMode: z.enum(["manual", "auto"]),
    // Manual mode: direct to specific feed
    feedId: z.string().optional(), // Required if distributionMode = "manual"
    // Auto mode: template-based feed creation
    feedTemplate: z.object({
      title: z.string(), // e.g., "{{category}} News Feed"
      description: z.string(), // e.g., "Latest {{category}} updates"
      link: z.string().optional(), // e.g., "https://example.com/{{category}}"
      category: z.string().optional(), // e.g., "{{category}}"
      language: z.string().default("en"),
    }).optional(),
  }),
  // Secrets (sensitive config, hydrated at runtime)
  z.object({
    apiKey: z.string().min(1, "API key is required"),
  }),
);

// Simple input schema - just the FeedItem to distribute
export const RssDistributorInputSchema = createInputSchema(FeedItem);

// Output schema with detailed results
export const RssDistributorOutputSchema = createOutputSchema(
  z.object({
    results: z.array(z.object({
      itemId: z.string(),
      feedId: z.string(),
      feedCreated: z.boolean().default(false), // True if feed was auto-created
      category: z.string().optional(),
      message: z.string().optional(),
    })),
    stats: z.object({
      totalItems: z.number(),
      successfulItems: z.number(),
      failedItems: z.number(),
      feedsCreated: z.number(),
      feedsUsed: z.array(z.string()),
    }),
    errors: z.array(z.object({
      itemId: z.string().optional(),
      error: z.string(),
      category: z.string().optional(),
    })).optional(),
  }),
);

// Derived types
export type RssDistributorConfig = z.infer<typeof RssDistributorConfigSchema>;
export type RssDistributorInput = z.infer<typeof RssDistributorInputSchema>;
export type RssDistributorOutput = z.infer<typeof RssDistributorOutputSchema>;
export type FeedTemplate = {
  title: string;
  description: string;
  link?: string;
  category?: string;
  language: string;
};
