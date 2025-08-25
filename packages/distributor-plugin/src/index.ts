import {
  ConfigurationError,
  Effect,
  type Plugin,
  PluginExecutionError,
  PluginLoggerTag,
} from "@usersdotfun/core-sdk";
import { RssClient } from "./client";
import {
  type RssConfig,
  RssConfigSchema,
  type RssInput,
  RssInputSchema,
  type RssOutput,
  RssOutputSchema,
} from "./schemas";

export class RssPlugin
  implements
    Plugin<
      typeof RssInputSchema,
      typeof RssOutputSchema,
      typeof RssConfigSchema
    >
{
  readonly id = "@rss/add-item-plugin" as const;
  readonly type = "transformer" as const;
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

      // Initialize Rss client with tRPC and auth client
      try {
        self.client = new RssClient(
          config.variables?.baseUrl || "http://localhost:1337",
          config.secrets.apiKey,
        );
      } catch (clientError) {
        const error = new ConfigurationError(
          `Failed to initialize Rss client: ${clientError instanceof Error ? clientError.message : "Unknown error"}`,
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

      yield* logger.logInfo("Rss plugin initialized successfully", {
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

      yield* logger.logDebug("Executing add item to feed workflow", {
        pluginId: self.id,
        feedId: input.feedId,
        itemTitle: input.item.title,
      });

      return yield* Effect.tryPromise({
        try: async () => {
          if (!self.client) {
            throw new Error("Client not initialized");
          }

          // Call the addFeedItem method on the client (passthrough)
          const result = await self.client.addFeedItem(input.feedId, input.item);
          
          return result;
        },
        catch: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return new PluginExecutionError(
            `Add item to feed workflow failed: ${errorMessage}`,
            true,
          );
        },
      });
    });
  }


  shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logInfo("Shutting down Rss plugin", {
        pluginId: self.id,
      });
      self.config = null;
      self.client = null;
    });
  }
}

export default RssPlugin;
