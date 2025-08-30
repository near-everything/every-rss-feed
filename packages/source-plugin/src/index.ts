import {
  ConfigurationError,
  Effect,
  type Plugin,
  PluginExecutionError,
  PluginLoggerTag,
} from "every-plugin";
import { RssClient } from "./client";
import {
  type RssConfig,
  RssConfigSchema,
  type RssInput,
  RssInputSchema,
  type RssOutput,
  RssOutputSchema,
  type RssState,
  type RssSearchOptions,
} from "./schemas";

export class RssPlugin
  implements
    Plugin<
      typeof RssInputSchema,
      typeof RssOutputSchema,
      typeof RssConfigSchema
    >
{
  readonly id = "@curatedotfun/rss-source" as const;
  readonly type = "source" as const;
  readonly inputSchema = RssInputSchema;
  readonly outputSchema = RssOutputSchema;
  readonly configSchema = RssConfigSchema;

  private config: RssConfig | null = null;
  private client: RssClient | null = null;

  initialize(
    config?: RssConfig,
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
        catch: (healthCheckError) => {
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
    input: RssInput,
  ): Effect.Effect<RssOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;

      if (!self.config || !self.client) {
        yield* Effect.fail(
          new PluginExecutionError("Plugin not initialized", false),
        );
      }

      const { searchOptions, lastProcessedState } = input;

      yield* logger.logDebug("Executing RSS source plugin", {
        pluginId: self.id,
        searchOptions,
        stateKeys: Object.keys(lastProcessedState || {}),
      });

      const state: RssState = {
        processedItemIds: lastProcessedState?.data?.processedItemIds || [],
        latestProcessedId: lastProcessedState?.data?.latestProcessedId,
        lastPollTime: lastProcessedState?.data?.lastPollTime,
        currentAsyncJob: lastProcessedState?.data?.currentAsyncJob || null,
      };

      // Handle directory request first if needed
      if (searchOptions.includeFeedDirectory) {
        return yield* self.executeDirectoryQuery(searchOptions, state, logger);
      }

      // Handle specific item queries
      if (searchOptions.itemIds?.length || searchOptions.itemId) {
        return yield* self.executeItemQuery(searchOptions, state, logger);
      }

      // Default: incremental feed processing
      return yield* self.executeIncrementalFeedQuery(searchOptions, state, logger);
    });
  }

  private executeDirectoryQuery(
    query: RssSearchOptions,
    state: RssState,
    logger: any,
  ): Effect.Effect<RssOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      yield* logger.logDebug("Fetching feed directory");

      const directory = yield* Effect.tryPromise({
        try: () => self.client!.getFeedDirectory(),
        catch: (error) =>
          new PluginExecutionError(
            `Directory fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      const now = new Date().toISOString();

      return {
        success: true,
        data: {
          items: [],
          feeds: [directory],
          stats: {
            totalItems: 0,
            newItems: 0,
            processedFeeds: 1,
          },
          nextLastProcessedState: {
            ...state,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    });
  }

  private executeItemQuery(
    query: RssSearchOptions,
    state: RssState,
    logger: any,
  ): Effect.Effect<RssOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      yield* logger.logDebug("Executing specific item query", {
        itemIds: query.itemIds,
        itemId: query.itemId,
        feedIds: query.feedIds,
        feedId: query.feedId,
      });

      const itemIds = query.itemIds || (query.itemId ? [query.itemId] : []);
      const feedIds = query.feedIds || (query.feedId ? [query.feedId] : []);

      if (itemIds.length === 0 || feedIds.length === 0) {
        yield* Effect.fail(
          new PluginExecutionError(
            "Both feedId(s) and itemId(s) are required for item queries",
            false,
          ),
        );
      }

      const requests: Array<{ feedId: string; itemId: string }> = [];
      for (const feedId of feedIds) {
        for (const itemId of itemIds) {
          requests.push({ feedId, itemId });
        }
      }

      const results = yield* Effect.tryPromise({
        try: () => self.client!.getFeedItems(requests),
        catch: (error) =>
          new PluginExecutionError(
            `Item query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      const items = results
        .filter((result) => result.item !== null)
        .map((result) => result.item);

      const now = new Date().toISOString();

      return {
        success: true,
        data: {
          items,
          stats: {
            totalItems: items.length,
            newItems: items.length,
            processedFeeds: feedIds.length,
          },
          nextLastProcessedState: {
            ...state,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    });
  }

  private executeIncrementalFeedQuery(
    query: RssSearchOptions,
    state: RssState,
    logger: any,
  ): Effect.Effect<RssOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      yield* logger.logDebug("Executing incremental feed query", {
        feedIds: query.feedIds,
        feedId: query.feedId,
        limit: query.limit,
        forceRefresh: query.forceRefresh,
      });

      // Determine target feeds
      const feedIds = query.feedIds || (query.feedId ? [query.feedId] : ["grants"]);

      let allNewItems: any[] = [];
      const updatedProcessedIds = new Set(state.processedItemIds || []);

      // Process each feed incrementally
      for (const feedId of feedIds) {
        yield* logger.logDebug(`Processing feed: ${feedId}`);

        const feedData = yield* Effect.tryPromise({
          try: () => self.client!.getFeed(feedId),
          catch: (error) =>
            new PluginExecutionError(
              `Feed fetch failed for ${feedId}: ${error instanceof Error ? error.message : "Unknown error"}`,
              true,
            ),
        });

        // Filter for new items only
        const newItems = feedData.items
          .filter((item: any) => {
            const itemId = item.guid || item.id || item.link;
            return itemId && !updatedProcessedIds.has(itemId);
          })
          .slice(0, query.limit);

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
        if (allNewItems.length >= query.limit) {
          allNewItems = allNewItems.slice(0, query.limit);
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

      yield* logger.logInfo("Incremental feed query completed", {
        totalNewItems: allNewItems.length,
        processedFeeds: feedIds.length,
        totalProcessedItems: processedArray.length,
      });

      return {
        success: true,
        data: {
          items: allNewItems,
          stats: {
            totalItems: allNewItems.length,
            newItems: allNewItems.length,
            processedFeeds: feedIds.length,
          },
          nextLastProcessedState: {
            latestProcessedId,
            processedItemIds: processedArray,
            lastPollTime: now,
            currentAsyncJob: null,
          },
        },
      };
    });
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

export default RssPlugin;
