import { createRouterClient } from "@orpc/server";
import { Effect, Layer } from "effect";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppRouter } from "../../routers/index";
import { DatabaseService } from "../../services/database.service";
import { PluginRuntimeService } from "../../services/plugin-runtime.service";

// Use a test database for integration tests
const TEST_DATABASE_URL = "file:./test-database.db";

describe("Server Integration Tests", () => {
  let redisContainer: StartedTestContainer;
  let orpcClient: any;
  let honoApp: any;

  beforeAll(async () => {
    // Spin up Redis container for testing
    redisContainer = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();

    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);

    const redisUrl = `redis://${redisHost}:${redisPort}`;

    // Set environment variables FIRST
    process.env.REDIS_URL = redisUrl;
    process.env.TURSO_CONNECTION_URL = TEST_DATABASE_URL;

    // Create services layer
    const AppLayer = Layer.mergeAll(
      DatabaseService.Default,
      PluginRuntimeService.Default
    );

    // Run server setup with scoped resource management
    const setupProgram = Effect.gen(function* () {
      const router = yield* createAppRouter;
      return router;
    });

    const appRouter = await Effect.runPromise(
      setupProgram.pipe(
        Effect.provide(AppLayer),
        Effect.scoped
      )
    );

    const serverModule = await import("../../index");
    honoApp = serverModule.default;

    // Create server-side router client (direct testing)
    orpcClient = createRouterClient(appRouter, {
      context: { session: null }
    });
  }, 120000);

  afterAll(async () => {
    await redisContainer.stop();
  });

  describe("basic endpoints", () => {
    it("should respond to health check", async () => {
      const result = await orpcClient.healthCheck();
      expect(result).toBe("OK");
    });
  });

  describe("RSS plugin integration", () => {
    it("should be able to get feeds", async () => {
      const feeds = await orpcClient.rss.getFeeds();
      expect(Array.isArray(feeds)).toBe(true);
    });

    it("should be able to add and delete a feed", async () => {
      const testFeed = {
        options: {
          id: "server-test-feed",
          title: "Server Test Feed",
          description: "Feed for server testing",
          link: "https://example.com",
          language: "en",
          copyright: "MIT"
        },
        items: [],
        categories: ["testing"],
        contributors: [],
        extensions: []
      };

      const feedId = await orpcClient.rss.addFeed(testFeed);
      expect(feedId).toBe("server-test-feed");

      const feed = await orpcClient.rss.getFeed({ feedId });
      expect(feed).toBeDefined();
      expect(feed?.options.title).toBe("Server Test Feed");

      const result = await orpcClient.rss.deleteFeed({ feedId });
      expect(result.success).toBe(true);

      const deletedFeed = await orpcClient.rss.getFeed({ feedId });
      expect(deletedFeed).toBeNull();
    });

    it("should get stats", async () => {
      const stats = await orpcClient.rss.getStats();
      expect(stats).toHaveProperty("totalFeeds");
      expect(stats).toHaveProperty("totalItems");
      expect(stats).toHaveProperty("totalCategories");
      expect(typeof stats.totalFeeds).toBe("number");
      expect(typeof stats.totalItems).toBe("number");
      expect(typeof stats.totalCategories).toBe("number");
    });
  });
});
