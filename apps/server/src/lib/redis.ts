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
