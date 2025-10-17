import type { PluginRegistry } from "every-plugin";
import { createLocalPluginRuntime } from "every-plugin/testing";
import { beforeAll, describe, expect, it } from "vitest";
import RSSPlugin from "../../index";

const TEST_REGISTRY: PluginRegistry = {
  "@curatedotfun/rss-plugin": {
    remoteUrl: "http://localhost:3014/remoteEntry.js",
    version: "1.0.0",
    description: "RSS Plugin for integration testing",
  },
};

const TEST_CONFIG = {
  variables: {
    timeout: 10000,
  },
  secrets: {
    redisUrl: "redis://localhost:6379",
  },
};

describe("RSS Plugin Integration Tests", () => {
  const runtime = createLocalPluginRuntime(
    {
      registry: TEST_REGISTRY,
    },
    { "@curatedotfun/rss-plugin": RSSPlugin }
  );

  beforeAll(async () => {
    const { initialized } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);
    expect(initialized).toBeDefined();
    expect(initialized.plugin.id).toBe("@curatedotfun/rss-plugin");
  });

  describe("health check", () => {
    it("should return OK", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const result = await client.healthCheck();
      expect(result).toBe("OK");
    });
  });

  describe("feed management", () => {
    const testFeed = {
      options: {
        id: "test-integration-feed",
        title: "Test Integration Feed",
        description: "A feed for integration testing",
        link: "https://example.com",
        language: "en",
        copyright: "MIT License"
      },
      items: [
        {
          id: "item-1",
          title: "First Test Item",
          description: "This is the first test item",
          link: "https://example.com/item-1",
          date: new Date().toISOString(),
          published: new Date().toISOString()
        },
        {
          id: "item-2",
          title: "Second Test Item",
          description: "This is the second test item",
          link: "https://example.com/item-2",
          date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          published: new Date(Date.now() - 3600000).toISOString(),
          category: [{ name: "tech" }, { term: "news" }]
        }
      ],
      categories: ["technology", "news"],
      contributors: [],
      extensions: []
    };

    it("should add a feed", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const feedId = await client.addFeed(testFeed);
      expect(feedId).toBe("test-integration-feed");
    });

    it("should retrieve a feed", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const feed = await client.getFeed({ feedId: "test-integration-feed" });
      expect(feed).toBeDefined();
      expect(feed?.options.title).toBe("Test Integration Feed");
      expect(feed?.options.id).toBe("test-integration-feed");
      expect(feed?.items).toHaveLength(2);
    });

    it("should retrieve feed items", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const items = await client.getFeedItems({ feedId: "test-integration-feed" });
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("First Test Item");
      expect(items[1].title).toBe("Second Test Item");
    });

    it("should retrieve a single feed item", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const result = await client.getFeedItem({
        feedId: "test-integration-feed",
        itemId: "item-1"
      });
      expect(result?.item).toBeDefined();
      expect(result?.item?.title).toBe("First Test Item");
      expect(result?.feedTitle).toBe("Test Integration Feed");
    });
  });

  describe("feed operations", () => {
    it("should list all feeds", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const feeds = await client.getFeeds();
      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeGreaterThanOrEqual(1);
      expect(feeds.some(feed => feed.options.id === "test-integration-feed")).toBe(true);
    });

    it("should add individual feed items", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const newItem = {
        title: "Third Test Item",
        description: "This is a newly added item",
        link: "https://example.com/item-3",
        date: new Date().toISOString(),
        published: new Date().toISOString(),
        category: [{ name: "tech" }]
      };

      const itemId = await client.addFeedItem({
        feedId: "test-integration-feed",
        item: newItem
      });

      expect(typeof itemId).toBe("string");
      expect(itemId.length).toBeGreaterThan(0);

      // Verify the item was added
      const result = await client.getFeedItem({
        feedId: "test-integration-feed",
        itemId
      });
      expect(result?.item?.title).toBe("Third Test Item");
    });
  });

  describe("aggregation", () => {
    it("should get all feed items", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const items = await client.getAllFeedItems();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(3);

      // Should be sorted by date (newest first)
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      expect(new Date(firstItem.published || firstItem.date).getTime())
        .toBeGreaterThanOrEqual(new Date(lastItem.published || lastItem.date).getTime());
    });

    it("should get all categories", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const categories = await client.getAllCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain("technology");
      expect(categories).toContain("news");
      expect(categories).toContain("tech");
    });

    it("should get items by category", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const techItems = await client.getItemsByCategory({ category: "tech" });
      expect(Array.isArray(techItems)).toBe(true);
      expect(techItems.every(item =>
        item.category?.some(cat => cat.name === "tech" || cat.term === "tech")
      )).toBe(true);
    });

    it("should get feeds by category", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const techFeeds = await client.getFeedsByCategory({ category: "technology" });
      expect(Array.isArray(techFeeds)).toBe(true);
      expect(techFeeds.some(feed => feed.options.id === "test-integration-feed")).toBe(true);
    });
  });

  describe("trending", () => {
    it("should track item views", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const result = await client.trackItemView({ itemId: "item-1" });
      expect(result.success).toBe(true);
    });

    it("should get trending items", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const trending = await client.getTrendingItems({ timeWindow: "24h" });
      expect(Array.isArray(trending)).toBe(true);
      // Should contain items that have been viewed
      if (trending.length > 0) {
        expect(trending[0]).toHaveProperty("id");
        expect(trending[0]).toHaveProperty("title");
      }
    });

    it("should get feed-specific trending", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const trending = await client.getFeedTrending({
        feedId: "test-integration-feed",
        timeWindow: "24h"
      });
      expect(Array.isArray(trending)).toBe(true);
    });
  });

  describe("RSS generation", () => {
    it("should generate RSS XML", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const rssXml = await client.getFeedRss({ feedId: "test-integration-feed" });
      expect(typeof rssXml).toBe("string");
      expect(rssXml).toContain("<rss");
      expect(rssXml).toContain("<channel>");
      expect(rssXml).toContain("Test Integration Feed");
    });

    it("should generate Atom XML", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const atomXml = await client.getFeedAtom({ feedId: "test-integration-feed" });
      expect(typeof atomXml).toBe("string");
      expect(atomXml).toContain("<feed");
      expect(atomXml).toContain("Test Integration Feed");
    });
  });

  describe("stats", () => {
    it("should return statistics", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const stats = await client.getStats();
      expect(stats).toHaveProperty("totalFeeds");
      expect(stats).toHaveProperty("totalItems");
      expect(stats).toHaveProperty("totalCategories");
      expect(typeof stats.totalFeeds).toBe("number");
      expect(typeof stats.totalItems).toBe("number");
      expect(typeof stats.totalCategories).toBe("number");
    });
  });

  describe("cleanup", () => {
    it("should delete a feed", async () => {
      const { client } = await runtime.usePlugin("@curatedotfun/rss-plugin", TEST_CONFIG);

      const result = await client.deleteFeed({ feedId: "test-integration-feed" });
      expect(result.success).toBe(true);

      // Verify feed is gone
      const feed = await client.getFeed({ feedId: "test-integration-feed" });
      expect(feed).toBeNull();
    });
  });
});
