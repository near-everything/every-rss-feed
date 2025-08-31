import { RedisClient } from "bun";
import { Context, Data, Effect, Layer } from "effect";
import { Feed, FeedItem } from "../schemas/feed";

export class RedisError extends Data.TaggedError("RedisError")<{
  message: string;
  cause?: unknown;
}> { }

export class RedisService extends Context.Tag("RedisService")<
  RedisService,
  {
    readonly addFeed: (feed: Feed) => Effect.Effect<string, RedisError>;
    readonly getFeed: (feedId: string) => Effect.Effect<Feed | null, RedisError>;
    readonly getFeeds: () => Effect.Effect<Feed[], RedisError>;
    readonly deleteFeed: (feedId: string) => Effect.Effect<void, RedisError>;
    readonly addFeedItem: (feedId: string, item: FeedItem) => Effect.Effect<string, RedisError>;
    readonly getFeedItems: (feedId: string) => Effect.Effect<FeedItem[], RedisError>;
    readonly getFeedItem: (feedId: string, itemId: string) => Effect.Effect<FeedItem | null, RedisError>;
    readonly getAllFeedItems: (options?: { limit?: number; offset?: number; since?: string }) => Effect.Effect<FeedItem[], RedisError>;
    readonly getAllCategories: () => Effect.Effect<string[], RedisError>;
    readonly getItemsByCategory: (category: string, options?: { limit?: number; offset?: number }) => Effect.Effect<FeedItem[], RedisError>;
    readonly getFeedsByCategory: (category: string) => Effect.Effect<Feed[], RedisError>;
    readonly getTrendingItems: (timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) => Effect.Effect<FeedItem[], RedisError>;
    readonly getFeedTrending: (feedId: string, timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) => Effect.Effect<FeedItem[], RedisError>;
    readonly trackItemView: (itemId: string) => Effect.Effect<void, RedisError>;
    readonly getStats: () => Effect.Effect<{ totalFeeds: number; totalItems: number; totalCategories: number }, RedisError>;
    readonly disconnect: () => Effect.Effect<void, never>;
  }
>() { }

export const RedisServiceLive = Layer.effect(
  RedisService,
  Effect.gen(function* () {
    const client = new RedisClient(
      process.env.REDIS_URL || "redis://localhost:6379"
    );

    const addFeed = (feed: Feed) =>
      Effect.tryPromise({
        try: async () => {
          const feedId = feed.options.id;

          // Check if feed exists to determine if this is an update
          const existingFeed = await client.get(`feed:${feedId}`);

          if (existingFeed) {
            // Update existing feed: clear old items first
            const oldItemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];

            // Delete old items
            for (const itemId of oldItemIds) {
              await client.del(`item:${itemId}`);
            }

            // Clear the items list
            await client.del(`feed:${feedId}:items`);
          }

          // Store the complete feed (overwrites if exists)
          await client.set(`feed:${feedId}`, JSON.stringify(feed));

          // Add to feeds directory (SADD handles duplicates)
          await client.send("SADD", ["feeds:directory", feedId]);

          // Store each item individually and maintain item list
          for (const item of feed.items) {
            const itemId = item.id || crypto.randomUUID();
            const itemWithId = { ...item, id: itemId };

            await client.set(`item:${itemId}`, JSON.stringify(itemWithId));
            await client.send("LPUSH", [`feed:${feedId}:items`, itemId]);
          }

          return feedId;
        },
        catch: (error) => new RedisError({
          message: `Failed to add feed ${feed.options.id}`,
          cause: error
        }),
      });

    const getFeed = (feedId: string) =>
      Effect.tryPromise({
        try: async () => {
          const feedData = await client.get(`feed:${feedId}`);
          return feedData ? JSON.parse(feedData) as Feed : null;
        },
        catch: (error) => new RedisError({
          message: `Failed to get feed ${feedId}`,
          cause: error
        }),
      });

    const getFeeds = () =>
      Effect.tryPromise({
        try: async () => {
          // Get all feed IDs from directory
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const feeds: Feed[] = [];

          for (const feedId of feedIds) {
            const feedData = await client.get(`feed:${feedId}`);
            if (feedData) {
              feeds.push(JSON.parse(feedData));
            }
          }

          return feeds;
        },
        catch: (error) => new RedisError({
          message: "Failed to get feeds",
          cause: error
        }),
      });

    const deleteFeed = (feedId: string) =>
      Effect.tryPromise({
        try: async () => {
          // Get all item IDs for this feed
          const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];

          // Delete all items
          for (const itemId of itemIds) {
            await client.del(`item:${itemId}`);
          }

          // Delete feed items list
          await client.del(`feed:${feedId}:items`);

          // Delete feed itself
          await client.del(`feed:${feedId}`);

          // Remove from feeds directory
          await client.send("SREM", ["feeds:directory", feedId]);
        },
        catch: (error) => new RedisError({
          message: `Failed to delete feed ${feedId}`,
          cause: error
        }),
      });

    const addFeedItem = (feedId: string, item: FeedItem) =>
      Effect.tryPromise({
        try: async () => {
          const itemId = item.id || crypto.randomUUID();
          const itemWithId = { ...item, id: itemId };

          // Store the item
          await client.set(`item:${itemId}`, JSON.stringify(itemWithId));

          // Add to feed's item list
          await client.send("LPUSH", [`feed:${feedId}:items`, itemId]);

          return itemId;
        },
        catch: (error) => new RedisError({
          message: `Failed to add item to feed ${feedId}`,
          cause: error
        }),
      });

    const getFeedItems = (feedId: string) =>
      Effect.tryPromise({
        try: async () => {
          const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];
          const items: FeedItem[] = [];

          for (const itemId of itemIds) {
            const itemData = await client.get(`item:${itemId}`);
            if (itemData) {
              items.push(JSON.parse(itemData));
            }
          }

          return items;
        },
        catch: (error) => new RedisError({
          message: `Failed to get items for feed ${feedId}`,
          cause: error
        }),
      });

    const getFeedItem = (feedId: string, itemId: string) =>
      Effect.tryPromise({
        try: async () => {
          const itemData = await client.get(`item:${itemId}`);
          return itemData ? JSON.parse(itemData) as FeedItem : null;
        },
        catch: (error) => new RedisError({
          message: `Failed to get item ${itemId} from feed ${feedId}`,
          cause: error
        }),
      });

    const getAllFeedItems = (options?: { limit?: number; offset?: number; since?: string }) =>
      Effect.tryPromise({
        try: async () => {
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const allItems: FeedItem[] = [];

          for (const feedId of feedIds) {
            const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];
            
            for (const itemId of itemIds) {
              const itemData = await client.get(`item:${itemId}`);
              if (itemData) {
                const item = JSON.parse(itemData) as FeedItem;
                
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
        catch: (error) => new RedisError({
          message: "Failed to get all feed items",
          cause: error
        }),
      });

    const getAllCategories = () =>
      Effect.tryPromise({
        try: async () => {
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const categories = new Set<string>();

          for (const feedId of feedIds) {
            const feedData = await client.get(`feed:${feedId}`);
            if (feedData) {
              const feed = JSON.parse(feedData) as Feed;
              
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
        catch: (error) => new RedisError({
          message: "Failed to get all categories",
          cause: error
        }),
      });

    const getItemsByCategory = (category: string, options?: { limit?: number; offset?: number }) =>
      Effect.tryPromise({
        try: async () => {
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const matchingItems: FeedItem[] = [];

          for (const feedId of feedIds) {
            const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];
            
            for (const itemId of itemIds) {
              const itemData = await client.get(`item:${itemId}`);
              if (itemData) {
                const item = JSON.parse(itemData) as FeedItem;
                
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
        catch: (error) => new RedisError({
          message: `Failed to get items by category ${category}`,
          cause: error
        }),
      });

    const getFeedsByCategory = (category: string) =>
      Effect.tryPromise({
        try: async () => {
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const matchingFeeds: Feed[] = [];

          for (const feedId of feedIds) {
            const feedData = await client.get(`feed:${feedId}`);
            if (feedData) {
              const feed = JSON.parse(feedData) as Feed;
              
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
        catch: (error) => new RedisError({
          message: `Failed to get feeds by category ${category}`,
          cause: error
        }),
      });

    const getTimeWindowSeconds = (timeWindow: '1h' | '24h' | '7d' | '30d'): number => {
      switch (timeWindow) {
        case '1h': return 3600;
        case '24h': return 86400;
        case '7d': return 604800;
        case '30d': return 2592000;
        default: return 86400;
      }
    };

    const getTrendingItems = (timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) =>
      Effect.tryPromise({
        try: async () => {
          const limit = options?.limit || 10;
          const now = Date.now();
          const windowSeconds = getTimeWindowSeconds(timeWindow);
          const cutoffTime = now - (windowSeconds * 1000);

          // Get trending item IDs from sorted set (highest scores first)
          const trendingItemIds = await client.send("ZREVRANGEBYSCORE", [
            `trending:${timeWindow}`,
            "+inf",
            cutoffTime.toString(),
            "LIMIT",
            "0",
            limit.toString()
          ]) as string[];

          const trendingItems: FeedItem[] = [];
          for (const itemId of trendingItemIds) {
            const itemData = await client.get(`item:${itemId}`);
            if (itemData) {
              trendingItems.push(JSON.parse(itemData) as FeedItem);
            }
          }

          return trendingItems;
        },
        catch: (error) => new RedisError({
          message: `Failed to get trending items for ${timeWindow}`,
          cause: error
        }),
      });

    const getFeedTrending = (feedId: string, timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) =>
      Effect.tryPromise({
        try: async () => {
          const limit = options?.limit || 10;
          const now = Date.now();
          const windowSeconds = getTimeWindowSeconds(timeWindow);
          const cutoffTime = now - (windowSeconds * 1000);

          // Get trending item IDs for specific feed
          const trendingItemIds = await client.send("ZREVRANGEBYSCORE", [
            `trending:feed:${feedId}:${timeWindow}`,
            "+inf",
            cutoffTime.toString(),
            "LIMIT",
            "0",
            limit.toString()
          ]) as string[];

          const trendingItems: FeedItem[] = [];
          for (const itemId of trendingItemIds) {
            const itemData = await client.get(`item:${itemId}`);
            if (itemData) {
              trendingItems.push(JSON.parse(itemData) as FeedItem);
            }
          }

          return trendingItems;
        },
        catch: (error) => new RedisError({
          message: `Failed to get trending items for feed ${feedId} in ${timeWindow}`,
          cause: error
        }),
      });

    const trackItemView = (itemId: string) =>
      Effect.tryPromise({
        try: async () => {
          const now = Date.now();
          const timeWindows: Array<'1h' | '24h' | '7d' | '30d'> = ['1h', '24h', '7d', '30d'];

          // Update trending scores for all time windows
          for (const window of timeWindows) {
            await client.send("ZADD", [`trending:${window}`, now.toString(), itemId]);
          }

          // Also track per-feed trending (need to find which feed this item belongs to)
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          for (const feedId of feedIds) {
            const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];
            if (itemIds.includes(itemId)) {
              for (const window of timeWindows) {
                await client.send("ZADD", [`trending:feed:${feedId}:${window}`, now.toString(), itemId]);
              }
              break;
            }
          }
        },
        catch: (error) => new RedisError({
          message: `Failed to track view for item ${itemId}`,
          cause: error
        }),
      });

    const getStats = () =>
      Effect.tryPromise({
        try: async () => {
          const feedIds = await client.send("SMEMBERS", ["feeds:directory"]) as string[];
          const totalFeeds = feedIds.length;

          let totalItems = 0;
          const categories = new Set<string>();

          for (const feedId of feedIds) {
            const itemIds = await client.send("LRANGE", [`feed:${feedId}:items`, "0", "-1"]) as string[];
            totalItems += itemIds.length;

            const feedData = await client.get(`feed:${feedId}`);
            if (feedData) {
              const feed = JSON.parse(feedData) as Feed;
              
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
        catch: (error) => new RedisError({
          message: "Failed to get stats",
          cause: error
        }),
      });

    const disconnect = () =>
      Effect.sync(() => {
        client.close();
      });

    return {
      addFeed,
      getFeed,
      getFeeds,
      deleteFeed,
      addFeedItem,
      getFeedItems,
      getFeedItem,
      getAllFeedItems,
      getAllCategories,
      getItemsByCategory,
      getFeedsByCategory,
      getTrendingItems,
      getFeedTrending,
      trackItemView,
      getStats,
      disconnect,
    };
  })
);

export const addFeed = (feed: Feed) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.addFeed(feed);
  });

export const getFeed = (feedId: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeed(feedId);
  });

export const getFeeds = () =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeeds();
  });

export const deleteFeed = (feedId: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.deleteFeed(feedId);
  });

export const addFeedItem = (feedId: string, item: FeedItem) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.addFeedItem(feedId, item);
  });

export const getFeedItems = (feedId: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeedItems(feedId);
  });

export const getFeedItem = (feedId: string, itemId: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeedItem(feedId, itemId);
  });

export const getAllFeedItems = (options?: { limit?: number; offset?: number; since?: string }) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getAllFeedItems(options);
  });

export const getAllCategories = () =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getAllCategories();
  });

export const getItemsByCategory = (category: string, options?: { limit?: number; offset?: number }) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getItemsByCategory(category, options);
  });

export const getFeedsByCategory = (category: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeedsByCategory(category);
  });

export const getTrendingItems = (timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getTrendingItems(timeWindow, options);
  });

export const getFeedTrending = (feedId: string, timeWindow: '1h' | '24h' | '7d' | '30d', options?: { limit?: number }) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getFeedTrending(feedId, timeWindow, options);
  });

export const trackItemView = (itemId: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.trackItemView(itemId);
  });

export const getStats = () =>
  Effect.gen(function* () {
    const redis = yield* RedisService;
    return yield* redis.getStats();
  });
