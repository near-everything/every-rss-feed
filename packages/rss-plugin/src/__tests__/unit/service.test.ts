import { GenericContainer, StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import { Effect } from "every-plugin/effect";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { RssService } from "../../service";

describe.sequential("RssService Workflow", () => {
  let container: StartedTestContainer;
  let redisClient: Redis;
  let service: RssService;
  let feedId: string;
  let itemId: string;

  beforeAll(async () => {
    // Start Redis container for integration testing
    container = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .start();

    // Create Redis client connected to test container
    const port = container.getMappedPort(6379);
    const host = container.getHost();

    redisClient = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    // Wait for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    service = new RssService(redisClient);
  }, 30000);

  afterAll(async () => {
    await redisClient.quit();
    await container.stop();
  });

  // Step 1: Basic service health check
  it("step 1: should have healthy service", async () => {
    const result = await Effect.runPromise(service.healthCheck());
    expect(result).toBe("OK");
  });

  // Step 2: Create a test feed with items
  it("step 2: should create a test feed", async () => {
    const testFeed = {
      options: {
        id: "workflow-test-feed",
        title: "Workflow Test Feed",
        description: "Sequential workflow testing",
        link: "https://workflow.test",
        copyright: "MIT License",
        language: "en"
      },
      items: [
        {
          id: "workflow-item-1",
          title: "Workflow Test Item 1",
          description: "First workflow item",
          link: "https://workflow.test/item-1",
          date: new Date().toISOString(),
          published: new Date().toISOString(),
          category: [{ name: "workflow" }]
        }
      ],
      categories: ["workflow", "testing"],
      contributors: [],
      extensions: []
    };

    feedId = await Effect.runPromise(service.addFeed(testFeed));
    expect(feedId).toBe("workflow-test-feed");

    // Verify feed was created
    const createdFeed = await Effect.runPromise(service.getFeed(feedId));
    expect(createdFeed?.options.title).toBe("Workflow Test Feed");
  });

  // Step 3: Test basic CRUD operations
  it("step 3: should retrieve feed items", async () => {
    const items = await Effect.runPromise(service.getFeedItems(feedId));
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Workflow Test Item 1");
  });

  it("step 4: should retrieve single feed item", async () => {
    const item = await Effect.runPromise(service.getFeedItem(feedId, "workflow-item-1"));
    expect(item?.title).toBe("Workflow Test Item 1");
  });

  // Step 5: Test aggregation
  it("step 5: should aggregate all feeds", async () => {
    const feeds = await Effect.runPromise(service.getFeeds());
    expect(feeds.length).toBeGreaterThan(0);
    expect(feeds.some(feed => feed.options.id === feedId)).toBe(true);
  });

  it("step 6: should aggregate all feed items", async () => {
    const allItems = await Effect.runPromise(service.getAllFeedItems({ limit: 5 }));
    expect(allItems.length).toBeGreaterThan(0);
  });

  // Step 7: Test categories
  it("step 7: should handle categories", async () => {
    // Get all categories
    const categories = await Effect.runPromise(service.getAllCategories());
    expect(categories).toContain("workflow");
    expect(categories).toContain("testing");

    // Get items by category
    const workflowItems = await Effect.runPromise(service.getItemsByCategory("workflow"));
    expect(workflowItems.length).toBeGreaterThan(0);

    // Get feeds by category
    const testingFeeds = await Effect.runPromise(service.getFeedsByCategory("testing"));
    expect(testingFeeds.some(feed => feed.options.id === feedId)).toBe(true);
  });

  // Step 8: Test trending functionality
  it("step 8: should track item views for trending", async () => {
    await Effect.runPromise(service.trackItemView("workflow-item-1"));

    // Get trending items (should include viewed item)
    const trending = await Effect.runPromise(service.getTrendingItems("24h"));
    expect(Array.isArray(trending)).toBe(true);
  });

  it("step 9: should get feed-specific trending", async () => {
    const feedTrending = await Effect.runPromise(service.getFeedTrending(feedId, "24h"));
    expect(Array.isArray(feedTrending)).toBe(true);
  });

  // Step 10: Add individual item
  it("step 10: should add individual item to feed", async () => {
    const newItem = {
      title: "Added Later Item",
      description: "Item added individually",
      link: "https://workflow.test/added-item",
      date: new Date().toISOString(),
      published: new Date().toISOString(),
      category: [{ name: "added" }]
    };

    itemId = await Effect.runPromise(service.addFeedItem(feedId, newItem));
    expect(typeof itemId).toBe("string");

    // Verify it was added
    const retrievedItem = await Effect.runPromise(service.getFeedItem(feedId, itemId));
    expect(retrievedItem?.title).toBe("Added Later Item");
  });

  // Step 11: Check stats after adding more content
  it("step 11: should provide accurate statistics", async () => {
    const stats = await Effect.runPromise(service.getStats());
    expect(stats.totalFeeds).toBeGreaterThan(0);
    expect(stats.totalItems).toBeGreaterThanOrEqual(2); // 1 original + 1 added
    expect(stats.totalCategories).toBeGreaterThanOrEqual(2); // workflow, testing, added
  });

  // Step 12: Test RSS generation
  it("step 12: should generate RSS feed", async () => {
    const rssXml = await Effect.runPromise(service.getFeedRss(feedId));
    expect(rssXml).toContain("<rss");
    expect(rssXml).toContain("Workflow Test Feed");
  });

  // Step 13: Test Atom generation
  it("step 13: should generate Atom feed", async () => {
    const atomXml = await Effect.runPromise(service.getFeedAtom(feedId));
    expect(atomXml).toContain("<feed");
    expect(atomXml).toContain("Workflow Test Feed");
  });

  // Step 14: Cleanup - delete the test feed
  it("step 14: should delete feed and cleanup", async () => {
    await Effect.runPromise(service.deleteFeed(feedId));

    // Verify feed is gone
    const deletedFeed = await Effect.runPromise(service.getFeed(feedId));
    expect(deletedFeed).toBeNull();

    // Verify item is gone too
    const deletedItem = await Effect.runPromise(service.getFeedItem(feedId, itemId));
    expect(deletedItem).toBeNull();
  });
});
