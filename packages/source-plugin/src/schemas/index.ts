import {
  createConfigSchema,
  createSourceInputSchema,
  createSourceOutputSchema,
  AsyncJobProgressSchema,
  z,
} from "every-plugin";
import { Feed, FeedItem } from "../../../../apps/server/src/schemas/feed";

// Config schema with variables and secrets
export const RssSourceConfigSchema = createConfigSchema(
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
export const RssSourceStateSchema = z.object({
  latestProcessedId: z.string().optional(),
  processedItemIds: z.array(z.string()).default([]),
  lastPollTime: z.string().datetime().optional(),
  currentAsyncJob: AsyncJobProgressSchema.nullable().optional(),
});

// Operation-based discriminated union for cleaner interfaces
export const RssOperationSchema = z.discriminatedUnion("operation", [
  // Get items from specific feeds (incremental processing)
  z.object({
    operation: z.literal("getFeedItems"),
    feedIds: z.array(z.string()).min(1, "At least one feed ID required"),
    limit: z.number().min(1).max(1000).default(100),
    forceRefresh: z.boolean().default(false),
  }),
  
  // Get a specific item from a feed
  z.object({
    operation: z.literal("getFeedItem"),
    feedId: z.string().min(1, "Feed ID is required"),
    itemId: z.string().min(1, "Item ID is required"),
  }),
  
  // Get all items across all feeds (cross-feed aggregation)
  z.object({
    operation: z.literal("getAllItems"),
    limit: z.number().min(1).max(1000).default(100),
    category: z.string().optional(), // Filter by category
    tag: z.string().optional(), // Filter by tag
    forceRefresh: z.boolean().default(false),
  }),
  
  // Get trending items (time-window based)
  z.object({
    operation: z.literal("getTrending"),
    timeWindow: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
    feedId: z.string().optional(), // Specific feed or all feeds
    limit: z.number().min(1).max(100).default(20),
  }),
  
  // Get items by category across feeds
  z.object({
    operation: z.literal("getByCategory"),
    category: z.string().min(1, "Category is required"),
    limit: z.number().min(1).max(1000).default(100),
  }),
  
  // Get statistics
  z.object({
    operation: z.literal("getStats"),
    feedId: z.string().optional(), // Specific feed or all feeds
  }),
]);

// Input schema using operation-based approach
export const RssSourceInputSchema = createSourceInputSchema(
  RssOperationSchema,
  RssSourceStateSchema
);

// Output schema with operation-specific data
export const RssSourceOutputSchema = createSourceOutputSchema(
  FeedItem,
  RssSourceStateSchema
);

// Derived types
export type RssSourceConfig = z.infer<typeof RssSourceConfigSchema>;
export type RssSourceInput = z.infer<typeof RssSourceInputSchema>;
export type RssSourceOutput = z.infer<typeof RssSourceOutputSchema>;
export type RssSourceState = z.infer<typeof RssSourceStateSchema>;
export type RssOperation = z.infer<typeof RssOperationSchema>;
