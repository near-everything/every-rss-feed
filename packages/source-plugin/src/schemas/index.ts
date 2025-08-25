import {
  createConfigSchema,
  createSourceInputSchema,
  createSourceOutputSchema,
  AsyncJobProgressSchema,
  z,
} from "@usersdotfun/core-sdk";

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

// State schema for incremental processing
export const RssStateSchema = z.object({
  latestProcessedId: z.string().optional(),
  processedItemIds: z.array(z.string()).default([]),
  lastPollTime: z.string().datetime().optional(),
  currentAsyncJob: AsyncJobProgressSchema.nullable().optional(),
});

// Search options schema - clean and focused
export const RssSearchOptionsSchema = z.object({
  // Flexible feed selection
  feedIds: z.array(z.string()).optional(), // Multiple feeds
  feedId: z.string().optional(), // Single feed (backwards compatibility)
  
  // Flexible item selection for specific queries
  itemIds: z.array(z.string()).optional(), // Query specific items
  itemId: z.string().optional(), // Single item (backwards compatibility)
  
  // Pagination & control
  limit: z.number().min(1).max(1000).default(100),
  forceRefresh: z.boolean().default(false),
  includeFeedDirectory: z.boolean().default(false), // Get available feeds list
});

// Input schema using source plugin pattern
export const RssInputSchema = createSourceInputSchema(
  RssSearchOptionsSchema,
  RssStateSchema
);

// Output schema using source plugin pattern
export const RssOutputSchema = createSourceOutputSchema(
  z.object({
    items: z.array(z.any()), // FeedItem[] from server schema
    feeds: z.array(z.any()).optional(), // Feed[] when includeFeedDirectory=true
    stats: z.object({
      totalItems: z.number(),
      newItems: z.number(),
      processedFeeds: z.number(),
    }),
  }),
  RssStateSchema
);

// Derived types
export type RssConfig = z.infer<typeof RssConfigSchema>;
export type RssInput = z.infer<typeof RssInputSchema>;
export type RssOutput = z.infer<typeof RssOutputSchema>;
export type RssState = z.infer<typeof RssStateSchema>;
export type RssSearchOptions = z.infer<typeof RssSearchOptionsSchema>;
