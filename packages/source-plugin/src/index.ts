import {
  ConfigurationError,
  Effect,
  type Plugin,
  PluginExecutionError,
  PluginLoggerTag,
  PluginSourceItem,
} from "every-plugin";
import { RssClient } from "./client";
import {
  type RssSourceConfig,
  RssSourceConfigSchema,
  type RssSourceInput,
  RssSourceInputSchema,
  type RssSourceOutput,
  RssSourceOutputSchema,
  type RssSourceState,
  type RssOperation,
} from "./schemas";
import type { FeedItem } from "../../../apps/server/src/schemas/feed";

export class RssSourcePlugin
  implements
    Plugin<
      typeof RssSourceInputSchema,
      typeof RssSourceOutputSchema,
      typeof RssSourceConfigSchema
    >
{
  readonly id = "@curatedotfun/rss-source" as const;
  readonly type = "source" as const;
  readonly inputSchema = RssSourceInputSchema;
  readonly outputSchema = RssSourceOutputSchema;
  readonly configSchema = RssSourceConfigSchema;

  private config: RssSourceConfig | null = null;
  private client: RssClient | null = null;

  private transformFeedItemToSourceItem(item: FeedItem): PluginSourceItem<FeedItem> {
    return {
      externalId: item.guid || item.id || item.link,
      content: item.content || item.description || item.title,
      contentType: 'feed',
      createdAt: item.date,
      url: item.link,
      authors: item.author?.map(author => ({
        displayName: author.name,
        username: author.name,
        url: author.link
      })),
      raw: item,
    };
  }

  initialize(
    config?: RssSourceConfig,
  ): Effect.Effect<void, ConfigurationError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;

      if (!config?.secrets?.apiKey) {
        const error = new ConfigurationError("API key is required.");
        yield* logger.logError(
          "Configuration error: API key is missing.",
          error,
        );
        yield* Effect.fail(error);
        return;
      }

      self.config = config;

      // Initialize RSS client with tRPC
      try {
        self.client = new RssClient(
          config.variables?.baseUrl || "http://localhost:1337",
          config.secrets.apiKey,
        );
      } catch (clientError) {
        const error = new ConfigurationError(
          `Failed to initialize RSS client: ${clientError instanceof Error ? clientError.message : "Unknown error"}`,
        );
        yield* logger.logError("Client initialization failed", error);
        yield* Effect.fail(error);
        return;
      }

      // Test connection
      yield* Effect.tryPromise({
        try: () => {
          if (!self.client) {
            throw new Error("Client not initialized");
          }
          return self.client.healthCheck();
        },
        catch: (healthCheckError): ConfigurationError => {
          const error = new ConfigurationError(
            `Health check failed: ${healthCheckError instanceof Error ? healthCheckError.message : "Unknown error"}`,
          );
          return error;
        },
      });

      yield* logger.logInfo("RSS plugin initialized successfully", {
        pluginId: self.id,
        baseUrl: config.variables?.baseUrl,
      });
    });
  }

  execute(
    input: RssSourceInput,
  ): Effect.Effect<RssSourceOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;

      if (!self.config || !self.client) {
        yield* Effect.fail(
          new PluginExecutionError("Plugin not initialized", false),
        );
      }

      const { searchOptions: operation, lastProcessedState } = input;

      yield* logger.logDebug("Executing RSS source plugin", {
        pluginId: self.id,
        operation: operation.operation,
        stateKeys: Object.keys(lastProcessedState || {}),
      });

      const state: RssSourceState = {
        processedItemIds: lastProcessedState?.data?.processedItemIds || [],
        latestProcessedId: lastProcessedState?.data?.latestProcessedId,
        lastPollTime: lastProcessedState?.data?.lastPollTime,
        currentAsyncJob: lastProcessedState?.data?.currentAsyncJob || null,
      };

      // Route to appropriate handler based on operation
      switch (operation.operation) {
        case "getFeedItems":
          return yield* self.executeGetFeedItems(operation, state);
        
        case "getAllItems":
          return yield* self.executeGetAllItems(operation, state);
        
        case "getTrending":
          return yield* self.executeGetTrending(operation, state);
        
        case "getByCategory":
          return yield* self.executeGetByCategory(operation, state);

        default:
          return yield* Effect.fail(
            new PluginExecutionError(`Unknown operation: ${(operation as any).operation}`, false),
          );
      }
    });
  }

  private executeGetFeedItems(
    operation: Extract<RssOperation, { operation: "getFeedItems" }>,
    state: RssSourceState,
  ): Effect.Effect<RssSourceOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logDebug("Fetching feed items", {
        feedIds: operation.feedIds,
        limit: operation.limit,
        forceRefresh: operation.forceRefresh,
      });

      let allNewItems: any[] = [];
      const updatedProcessedIds = new Set(state.processedItemIds || []);

      // Process each feed incrementally
      for (const feedId of operation.feedIds) {
        yield* logger.logDebug(`Processing feed: ${feedId}`);

        const feedData = yield* Effect.tryPromise({
          try: () => self.client!.getFeedItems(feedId),
          catch: (error): PluginExecutionError =>
            new PluginExecutionError(
              `Feed fetch failed for ${feedId}: ${error instanceof Error ? error.message : "Unknown error"}`,
              true,
            ),
        });

        if (!feedData) continue;

        // Filter for new items only (unless force refresh)
        const newItems = operation.forceRefresh 
          ? feedData.slice(0, operation.limit)
          : feedData
              .filter((item: any) => {
                const itemId = item.guid || item.id || item.link;
                return itemId && !updatedProcessedIds.has(itemId);
              })
              .slice(0, operation.limit);

        yield* logger.logDebug(`Found ${newItems.length} new items in feed ${feedId}`);

        // Track processed items
        newItems.forEach((item: any) => {
          const itemId = item.guid || item.id || item.link;
          if (itemId) {
            updatedProcessedIds.add(itemId);
          }
        });

        allNewItems.push(...newItems);

        // Respect the overall limit across all feeds
        if (allNewItems.length >= operation.limit) {
          allNewItems = allNewItems.slice(0, operation.limit);
          break;
        }
      }

      // Maintain reasonable state size (keep last 1000 processed items)
      const processedArray = Array.from(updatedProcessedIds).slice(-1000);
      const now = new Date().toISOString();

      const latestProcessedId = allNewItems.length > 0 
        ? (allNewItems[allNewItems.length - 1]?.guid || 
           allNewItems[allNewItems.length - 1]?.id || 
           allNewItems[allNewItems.length - 1]?.link || 
           state.latestProcessedId)
        : state.latestProcessedId;

      yield* logger.logInfo("Feed items query completed", {
        totalNewItems: allNewItems.length,
        processedFeeds: operation.feedIds.length,
        totalProcessedItems: processedArray.length,
      });

      // Transform raw FeedItems to expected source plugin format
      const transformedItems = allNewItems.map((item: FeedItem) => self.transformFeedItemToSourceItem(item));

      return {
        success: true,
        data: {
          items: transformedItems,
          nextLastProcessedState: {
            latestProcessedId,
            processedItemIds: processedArray,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`Feed items execution error: ${error}`, true)
      )
    );
  }

  private executeGetAllItems(
    operation: Extract<RssOperation, { operation: "getAllItems" }>,
    state: RssSourceState,
  ): Effect.Effect<RssSourceOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logDebug("Fetching all items across feeds", {
        limit: operation.limit,
        category: operation.category,
        tag: operation.tag,
        forceRefresh: operation.forceRefresh,
      });

      let items: any[] = [];

      if (operation.category) {
        // Get items by category
        items = yield* Effect.tryPromise({
          try: () => self.client!.getItemsByCategory(operation.category!, operation.limit),
          catch: (error): PluginExecutionError =>
            new PluginExecutionError(
              `Category items fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              true,
            ),
        });
      } else {
        // Get all items across feeds
        items = yield* Effect.tryPromise({
          try: () => self.client!.getAllFeedItems(operation.limit),
          catch: (error): PluginExecutionError =>
            new PluginExecutionError(
              `All items fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              true,
            ),
        });
      }

      const now = new Date().toISOString();

      // Transform raw FeedItems to expected source plugin format
      const transformedItems = items.map((item: FeedItem) => self.transformFeedItemToSourceItem(item));

      return {
        success: true,
        data: {
          items: transformedItems,
          nextLastProcessedState: {
            ...state,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`All items execution error: ${error}`, true)
      )
    );
  }

  private executeGetTrending(
    operation: Extract<RssOperation, { operation: "getTrending" }>,
    state: RssSourceState,
  ): Effect.Effect<RssSourceOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logDebug("Fetching trending items", {
        timeWindow: operation.timeWindow,
        feedId: operation.feedId,
        limit: operation.limit,
      });

      const trending = yield* Effect.tryPromise({
        try: () => operation.feedId 
          ? self.client!.getFeedTrending(operation.feedId, operation.timeWindow, operation.limit)
          : self.client!.getTrendingItems(operation.timeWindow, operation.limit),
        catch: (error): PluginExecutionError =>
          new PluginExecutionError(
            `Trending fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      const now = new Date().toISOString();

      return {
        success: true,
        data: {
          items: [],
          trending,
          stats: {
            totalItems: trending.length,
            newItems: trending.length,
            processedFeeds: operation.feedId ? 1 : 0,
          },
          nextLastProcessedState: {
            ...state,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`Trending execution error: ${error}`, true)
      )
    );
  }

  private executeGetByCategory(
    operation: Extract<RssOperation, { operation: "getByCategory" }>,
    state: RssSourceState,
  ): Effect.Effect<RssSourceOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logDebug("Fetching items by category", {
        category: operation.category,
        limit: operation.limit,
      });

      const items = yield* Effect.tryPromise({
        try: () => self.client!.getItemsByCategory(operation.category, operation.limit),
        catch: (error): PluginExecutionError =>
          new PluginExecutionError(
            `Category items fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      const now = new Date().toISOString();

      // Transform raw FeedItems to expected source plugin format
      const transformedItems = items.map((item: FeedItem) => self.transformFeedItemToSourceItem(item));

      return {
        success: true,
        data: {
          items: transformedItems,
          nextLastProcessedState: {
            ...state,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`Category execution error: ${error}`, true)
      )
    );
  }

  shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logInfo("Shutting down RSS plugin", {
        pluginId: self.id,
      });
      self.config = null;
      self.client = null;
    });
  }
}

export default RssSourcePlugin;
