import { Effect, Layer, Context, Data } from "effect";
import { redis, RedisClient } from "bun";
import { FeedItem } from "../schemas/feed";

export class RedisError extends Data.TaggedError("RedisError")<{
  message: string;
  cause?: unknown;
}> {}

export class RedisService extends Context.Tag("RedisService")<
  RedisService,
  {
    readonly addFeedItem: (feedId: string, item: FeedItem) => Effect.Effect<string, RedisError>;
    readonly getFeedItems: (feedId: string) => Effect.Effect<FeedItem[], RedisError>;
    readonly disconnect: () => Effect.Effect<void, never>;
  }
>() {}

export const RedisServiceLive = Layer.effect(
  RedisService,
  Effect.gen(function* () {
    const client = new RedisClient(
      process.env.REDIS_URL || "redis://localhost:6379"
    );

    const addFeedItem = (feedId: string, item: FeedItem) =>
      Effect.tryPromise({
        try: async () => {
          const itemId = item.id || crypto.randomUUID();
          const itemWithId = { ...item, id: itemId };
          
          // Store the item
          await client.set(`item:${itemId}`, JSON.stringify(itemWithId));
          
          // Add to feed's item list using raw command for LPUSH
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
          // Get all item IDs from the feed list using raw command for LRANGE
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

    const disconnect = () =>
      Effect.sync(() => {
        client.close();
      });

    return {
      addFeedItem,
      getFeedItems,
      disconnect,
    };
  })
);

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
