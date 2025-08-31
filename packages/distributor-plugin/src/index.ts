import {
  ConfigurationError,
  Effect,
  type Plugin,
  PluginExecutionError,
  PluginLoggerTag,
} from "every-plugin";
import { RssClient } from "./client";
import {
  type RssDistributorConfig,
  RssDistributorConfigSchema,
  type RssDistributorInput,
  RssDistributorInputSchema,
  type RssDistributorOutput,
  RssDistributorOutputSchema,
} from "./schemas";
import { createFeedFromTemplate, extractCategory, generateFeedId } from "./templating";

export class RssDistributorPlugin
  implements
    Plugin<
      typeof RssDistributorInputSchema,
      typeof RssDistributorOutputSchema,
      typeof RssDistributorConfigSchema
    >
{
  readonly id = "@curatedotfun/rss-distributor" as const;
  readonly type = "transformer" as const;
  readonly inputSchema = RssDistributorInputSchema;
  readonly outputSchema = RssDistributorOutputSchema;
  readonly configSchema = RssDistributorConfigSchema;

  private config: RssDistributorConfig | null = null;
  private client: RssClient | null = null;

  initialize(
    config?: RssDistributorConfig,
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

      yield* logger.logInfo("RSS distributor plugin initialized successfully", {
        pluginId: self.id,
        baseUrl: config.variables?.baseUrl,
      });
    });
  }

  execute(
    input: RssDistributorInput,
  ): Effect.Effect<RssDistributorOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;

      if (!self.config || !self.client) {
        yield* Effect.fail(
          new PluginExecutionError("Plugin not initialized", false),
        );
      }

      const distributionMode = self.config?.variables?.distributionMode || "manual";

      yield* logger.logDebug("Executing RSS distributor plugin", {
        pluginId: self.id,
        distributionMode,
        itemTitle: input.title,
      });

      // Route to appropriate handler based on configuration
      switch (distributionMode) {
        case "manual":
          return yield* self.executeManualMode(input);
        
        case "auto":
          return yield* self.executeAutoMode(input);
        
        default:
          return yield* Effect.fail(
            new PluginExecutionError(`Unknown distribution mode: ${distributionMode}`, false),
          );
      }
    });
  }

  private executeManualMode(
    item: RssDistributorInput,
  ): Effect.Effect<RssDistributorOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      const feedId = self.config!.variables?.feedId;
      
      if (!feedId) {
        yield* Effect.fail(
          new PluginExecutionError("feedId is required for manual distribution mode", false),
        );
      }

      yield* logger.logDebug("Executing manual distribution mode", {
        feedId,
        itemTitle: item.title,
      });

      const result = yield* Effect.tryPromise({
        try: () => self.client!.addFeedItem(feedId!, item),
        catch: (error): PluginExecutionError =>
          new PluginExecutionError(
            `Failed to add item to feed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      const category = extractCategory(item);

      return {
        success: true,
        data: {
          results: [{
            itemId: result.itemId,
            feedId: feedId!,
            feedCreated: false,
            category,
            message: result.message,
          }],
          stats: {
            totalItems: 1,
            successfulItems: 1,
            failedItems: 0,
            feedsCreated: 0,
            feedsUsed: [feedId!],
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`Manual mode error: ${error}`, true)
      )
    );
  }

  private executeAutoMode(
    item: RssDistributorInput,
  ): Effect.Effect<RssDistributorOutput, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      const feedTemplate = self.config!.variables?.feedTemplate;
      
      if (!feedTemplate) {
        yield* Effect.fail(
          new PluginExecutionError("feedTemplate is required for auto distribution mode", false),
        );
      }

      const category = extractCategory(item);
      const feedId = generateFeedId(category);

      yield* logger.logDebug("Executing auto distribution mode", {
        category,
        feedId,
        itemTitle: item.title,
      });

      // Check if feed already exists
      const existingFeed = yield* Effect.tryPromise({
        try: () => self.client!.getFeed(feedId),
        catch: (): null => null, // Feed doesn't exist, we'll create it
      });

      let feedCreated = false;

      if (!existingFeed) {
        // Create feed from template
        const { feed } = createFeedFromTemplate(item, feedTemplate!);
        
        yield* logger.logDebug("Creating new feed from template", {
          feedId,
          feedTitle: feed.options.title,
        });

        yield* Effect.tryPromise({
          try: () => self.client!.addFeed(feed),
          catch: (error): PluginExecutionError =>
            new PluginExecutionError(
              `Failed to create feed: ${error instanceof Error ? error.message : "Unknown error"}`,
              true,
            ),
        });

        feedCreated = true;
      }

      // Add item to feed
      const result = yield* Effect.tryPromise({
        try: () => self.client!.addFeedItem(feedId, item),
        catch: (error): PluginExecutionError =>
          new PluginExecutionError(
            `Failed to add item to feed: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          ),
      });

      yield* logger.logInfo("Auto distribution completed", {
        feedId,
        itemId: result.itemId,
        feedCreated,
        category,
      });

      return {
        success: true,
        data: {
          results: [{
            itemId: result.itemId,
            feedId,
            feedCreated,
            category,
            message: result.message,
          }],
          stats: {
            totalItems: 1,
            successfulItems: 1,
            failedItems: 0,
            feedsCreated: feedCreated ? 1 : 0,
            feedsUsed: [feedId],
          },
        },
      };
    }).pipe(
      Effect.mapError((error) => 
        error instanceof PluginExecutionError ? error : 
        new PluginExecutionError(`Auto mode error: ${error}`, true)
      )
    );
  }

  shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logInfo("Shutting down RSS distributor plugin", {
        pluginId: self.id,
      });
      self.config = null;
      self.client = null;
    });
  }
}

export default RssDistributorPlugin;
