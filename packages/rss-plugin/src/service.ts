import { Effect } from "every-plugin/effect";
import { Redis } from "ioredis";
import { generateAtomXml, generateRssXml } from "./feed-generator";
import type { Feed, FeedItem } from "./schemas/feed";
import { FeedItem as FeedItemSchema, Feed as FeedSchema } from "./schemas/feed";

export class RedisError {
  readonly _tag = "RedisError" as const;
  constructor(
    readonly message: string,
    readonly cause?: unknown
  ) { }
}

/**
 * RSS Service class with embedded Redis operations.
 * This consolidates all the logic from server into a single service.
 */
export class RssService {
  private client: Redis;

  constructor(redisUrlOrClient: string | Redis = "redis://localhost:6379") {
    if (typeof redisUrlOrClient === "string") {
      this.client = new Redis(redisUrlOrClient);
    } else {
      this.client = redisUrlOrClient;
    }
  }

  // Read operations
  getFeeds() {
    return Effect.tryPromise({
      try: async () => {
        // Get all feed IDs from directory
        const feedIds = await this.client.smembers("feeds:directory");
        const feeds: Feed[] = [];

        for (const feedId of feedIds) {
          const feedData = await this.client.get(`feed:${feedId}`);
          if (feedData) {
            feeds.push(FeedSchema.parse(JSON.parse(feedData)));
          }
        }

        return feeds;
      },
      catch: (error) => new RedisError("Failed to get feeds", error)
    });
  }

  getFeed(feedId: string) {
    return Effect.tryPromise({
      try: async () => {
        const feedData = await this.client.get(`feed:${feedId}`);
        return feedData ? FeedSchema.parse(JSON.parse(feedData)) : null;
      },
      catch: (error) => new RedisError(`Failed to get feed ${feedId}`,
        error
      )
    });
  }

  getFeedItems(feedId: string) {
    return Effect.tryPromise({
      try: async () => {
        const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);
        const items: FeedItem[] = [];

        for (const itemId of itemIds) {
          const itemData = await this.client.get(`item:${itemId}`);
          if (itemData) {
            items.push(FeedItemSchema.parse(JSON.parse(itemData)));
          }
        }

        return items;
      },
      catch: (error) => new RedisError(`Failed to get items for feed ${feedId}`,
        error
      )
    });
  }

  getFeedItem(feedId: string, itemId: string) {
    return Effect.tryPromise({
      try: async () => {
        const itemData = await this.client.get(`item:${itemId}`);
        return itemData ? FeedItemSchema.parse(JSON.parse(itemData)) : null;
      },
      catch: (error) => new RedisError(`Failed to get item ${itemId} from feed ${feedId}`,
        error
      )
    });
  }

  // Aggregation operations
  getAllFeedItems(options?: { limit?: number; offset?: number; since?: string }) {
    return Effect.tryPromise({
      try: async () => {
        const feedIds = await this.client.smembers("feeds:directory");
        const allItems: FeedItem[] = [];

        for (const feedId of feedIds) {
          const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);

          for (const itemId of itemIds) {
            const itemData = await this.client.get(`item:${itemId}`);
            if (itemData) {
              const item = FeedItemSchema.parse(JSON.parse(itemData));

              // Filter by date if since is provided
              if (options?.since) {
                const itemDate = new Date(item.published || item.date);
                const sinceDate = new Date(options.since);
                if (itemDate < sinceDate) continue;
              }

              allItems.push(item);
            }
          }
        }

        // Sort by date (newest first)
        allItems.sort((a, b) => {
          const dateA = new Date(a.published || a.date);
          const dateB = new Date(b.published || b.date);
          return dateB.getTime() - dateA.getTime();
        });

        // Apply pagination
        const start = options?.offset || 0;
        const end = start + (options?.limit || 50);
        return allItems.slice(start, end);
      },
      catch: (error) => new RedisError(
        "Failed to get all feed items",
        error
      )
    });
  }

  getAllCategories() {
    return Effect.tryPromise({
      try: async () => {
        const feedIds = await this.client.smembers("feeds:directory");
        const categories = new Set<string>();

        for (const feedId of feedIds) {
          const feedData = await this.client.get(`feed:${feedId}`);
          if (feedData) {
            const feed = FeedSchema.parse(JSON.parse(feedData));

            // Add feed-level categories
            feed.categories?.forEach(cat => categories.add(cat));

            // Add item-level categories
            feed.items?.forEach(item => {
              item.category?.forEach(cat => {
                if (cat.name) categories.add(cat.name);
                if (cat.term) categories.add(cat.term);
              });
            });
          }
        }

        return Array.from(categories).sort();
      },
      catch: (error) => new RedisError(
        "Failed to get all categories",
        error
      )
    });
  }

  getItemsByCategory(category: string, options?: { limit?: number; offset?: number }) {
    return Effect.tryPromise({
      try: async () => {
        const feedIds = await this.client.smembers("feeds:directory");
        const matchingItems: FeedItem[] = [];

        for (const feedId of feedIds) {
          const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);

          for (const itemId of itemIds) {
            const itemData = await this.client.get(`item:${itemId}`);
            if (itemData) {
              const item = FeedItemSchema.parse(JSON.parse(itemData));

              // Check if item matches category (name or term)
              const hasCategory = item.category?.some(cat =>
                cat.name === category || cat.term === category
              );

              if (hasCategory) {
                matchingItems.push(item);
              }
            }
          }
        }

        // Sort by date (newest first)
        matchingItems.sort((a, b) => {
          const dateA = new Date(a.published || a.date);
          const dateB = new Date(b.published || b.date);
          return dateB.getTime() - dateA.getTime();
        });

        // Apply pagination
        const start = options?.offset || 0;
        const end = start + (options?.limit || 50);
        return matchingItems.slice(start, end);
      },
      catch: (error) => new RedisError(
        `Failed to get items by category ${category}`,
        error
      )
    });
  }

  getFeedsByCategory(category: string) {
    return Effect.tryPromise({
      try: async () => {
        const feedIds = await this.client.smembers("feeds:directory");
        const matchingFeeds: Feed[] = [];

        for (const feedId of feedIds) {
          const feedData = await this.client.get(`feed:${feedId}`);
          if (feedData) {
            const feed = FeedSchema.parse(JSON.parse(feedData));

            // Check if feed has this category
            const hasCategory = feed.categories?.includes(category) ||
              feed.items?.some(item =>
                item.category?.some(cat =>
                  cat.name === category || cat.term === category
                )
              );

            if (hasCategory) {
              matchingFeeds.push(feed);
            }
          }
        }

        return matchingFeeds;
      },
      catch: (error) => new RedisError(
        `Failed to get feeds by category ${category}`,
        error
      )
    });
  }

  // Write operations
  addFeed(feed: Feed) {
    return Effect.tryPromise({
      try: async () => {
        const feedId = feed.options.id;

        // Check if feed exists to determine if this is an update
        const existingFeed = await this.client.get(`feed:${feedId}`);

        if (existingFeed) {
          // Update existing feed: clear old items first
          const oldItemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);

          // Delete old items
          for (const itemId of oldItemIds) {
            await this.client.del(`item:${itemId}`);
          }

          // Clear the items list
          await this.client.del(`feed:${feedId}:items`);
        }

        // Store the complete feed (overwrites if exists)
        await this.client.set(`feed:${feedId}`, JSON.stringify(feed));

        // Add to feeds directory (SADD handles duplicates)
        await this.client.sadd("feeds:directory", feedId);

        // Store each item individually and maintain item list
        for (const item of feed.items) {
          const itemId = item.id || crypto.randomUUID();
          const itemWithId = { ...item, id: itemId };

          await this.client.set(`item:${itemId}`, JSON.stringify(itemWithId));
          await this.client.lpush(`feed:${feedId}:items`, itemId);
        }

        return feedId;
      },
      catch: (error) => new RedisError(
        `Failed to add feed ${feed.options.id}`,
        error
      )
    });
  }

  addFeedItem(feedId: string, item: FeedItem) {
    return Effect.tryPromise({
      try: async () => {
        const itemId = item.id || crypto.randomUUID();
        const itemWithId = { ...item, id: itemId };

        // Store the item
        await this.client.set(`item:${itemId}`, JSON.stringify(itemWithId));

        // Add to feed's item list
        await this.client.lpush(`feed:${feedId}:items`, itemId);

        return itemId;
      },
      catch: (error) => new RedisError(
        `Failed to add item to feed ${feedId}`,
        error
      )
    });
  }

  deleteFeed(feedId: string) {
    return Effect.tryPromise({
      try: async () => {
        // Get all item IDs for this feed
        const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);

        // Delete all items
        for (const itemId of itemIds) {
          await this.client.del(`item:${itemId}`);
        }

        // Delete feed items list
        await this.client.del(`feed:${feedId}:items`);

        // Delete feed itself
        await this.client.del(`feed:${feedId}`);

        // Remove from feeds directory
        await this.client.srem("feeds:directory", feedId);
      },
      catch: (error) => new RedisError(
        `Failed to delete feed ${feedId}`,
        error
      )
    });
  }

  // Trending operations
  getTrendingItems(timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) {
    return Effect.tryPromise({
      try: async () => {
        const limit = options?.limit || 10;
        const now = Date.now();
        const windowSeconds = this.getTimeWindowSeconds(timeWindow);
        const cutoffTime = now - (windowSeconds * 1000);

        // Get trending item IDs from sorted set (highest scores first)
        const trendingItemIds = await this.client.zrevrangebyscore(
          `trending:${timeWindow}`,
          '+inf',
          cutoffTime,
          'LIMIT',
          0,
          limit
        );

        const trendingItems: FeedItem[] = [];
        for (const itemId of trendingItemIds) {
          const itemData = await this.client.get(`item:${itemId}`);
          if (itemData) {
            trendingItems.push(FeedItemSchema.parse(JSON.parse(itemData)));
          }
        }

        return trendingItems;
      },
      catch: (error) => new RedisError(`Failed to get trending items for ${timeWindow}`, error)
    });
  }

  getFeedTrending(feedId: string, timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) {
    return Effect.tryPromise({
      try: async () => {
        const limit = options?.limit || 10;
        const now = Date.now();
        const windowSeconds = this.getTimeWindowSeconds(timeWindow);
        const cutoffTime = now - (windowSeconds * 1000);

        // Get trending item IDs for specific feed
        const trendingItemIds = await this.client.zrevrangebyscore(
          `trending:feed:${feedId}:${timeWindow}`,
          '+inf',
          cutoffTime,
          'LIMIT',
          0,
          limit
        );

        const trendingItems: FeedItem[] = [];
        for (const itemId of trendingItemIds) {
          const itemData = await this.client.get(`item:${itemId}`);
          if (itemData) {
            trendingItems.push(FeedItemSchema.parse(JSON.parse(itemData)));
          }
        }

        return trendingItems;
      },
      catch: (error) => new RedisError(`Failed to get trending items for feed ${feedId} in ${timeWindow}`, error)
    });
  }

  trackItemView(itemId: string) {
    return Effect.tryPromise({
      try: async () => {
        const now = Date.now();
        const timeWindows: Array<'1h' | '24h' | '7d' | '30d'> = ['1h', '24h', '7d', '30d'];

        // Update trending scores for all time windows
        for (const window of timeWindows) {
          await this.client.zadd(`trending:${window}`, now, itemId);
        }

        // Also track per-feed trending (need to find which feed this item belongs to)
        const feedIds = await this.client.smembers("feeds:directory");
        for (const feedId of feedIds) {
          const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);
          if (itemIds.includes(itemId)) {
            for (const window of timeWindows) {
              await this.client.zadd(`trending:feed:${feedId}:${window}`, now, itemId);
            }
            break;
          }
        }
      },
      catch: (error) => new RedisError(`Failed to track view for item ${itemId}`, error)
    });
  }

  // Utility operations
  getStats() {
    return Effect.tryPromise({
      try: async () => {
        const feedIds = await this.client.smembers("feeds:directory");
        const totalFeeds = feedIds.length;

        let totalItems = 0;
        const categories = new Set<string>();

        for (const feedId of feedIds) {
          const itemIds = await this.client.lrange(`feed:${feedId}:items`, 0, -1);
          totalItems += itemIds.length;

          const feedData = await this.client.get(`feed:${feedId}`);
          if (feedData) {
            const feed = FeedSchema.parse(JSON.parse(feedData));

            // Count categories
            feed.categories?.forEach(cat => categories.add(cat));
            feed.items?.forEach(item => {
              item.category?.forEach(cat => {
                if (cat.name) categories.add(cat.name);
                if (cat.term) categories.add(cat.term);
              });
            });
          }
        }

        return {
          totalFeeds,
          totalItems,
          totalCategories: categories.size
        };
      },
      catch: (error) => new RedisError("Failed to get stats", error)
    });
  }

  // RSS format operations
  getFeedRss(feedId: string) {
    return Effect.tryPromise({
      try: async () => {
        const feed = await this.getFeed(feedId).pipe(Effect.runPromise);
        if (!feed) {
          throw new Error(`Feed ${feedId} not found`);
        }

        const baseUrl = process.env.BASE_URL || "http://localhost:1337";
        return generateRssXml(feed, baseUrl);
      },
      catch: (error) =>
        new Error(`Failed to generate RSS: ${error instanceof Error ? error.message : error}`)
    });
  }

  getFeedAtom(feedId: string) {
    return Effect.tryPromise({
      try: async () => {
        const feed = await this.getFeed(feedId).pipe(Effect.runPromise);
        if (!feed) {
          throw new Error(`Feed ${feedId} not found`);
        }

        const baseUrl = process.env.BASE_URL || "http://localhost:1337";
        return generateAtomXml(feed, baseUrl);
      },
      catch: (error) =>
        new Error(`Failed to generate Atom: ${error instanceof Error ? error.message : error}`)
    });
  }

  // Health check
  healthCheck() {
    return Effect.tryPromise({
      try: () => Promise.resolve("OK"),
      catch: (error) => new Error(`Health check failed: ${error}`)
    });
  }

  private getTimeWindowSeconds(timeWindow: '1h' | '24h' | '7d' | '30d'): number {
    switch (timeWindow) {
      case '1h': return 3600;
      case '24h': return 86400;
      case '7d': return 604800;
      case '30d': return 2592000;
      default: return 86400;
    }
  }
}
