import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { RssService } from "./service";

/**
 * RSS Plugin - Unified RSS feed management providing consistent RSS operations.
 *
 * Access to feeds, items, categories, trending, and RSS/Atom generation.
 */
export default createPlugin({
  id: "@curatedotfun/rss-plugin",

  variables: z.object({
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({
    redisUrl: z.string().default("redis://localhost:6379"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new RssService(config.secrets.redisUrl);
      yield* service.healthCheck();
      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {

    return {
      healthCheck: builder.healthCheck.handler(async () => {
        return await Effect.runPromise(context.service.healthCheck());
      }),

      getFeeds: builder.getFeeds.handler(async () => {
        return await Effect.runPromise(context.service.getFeeds());
      }),

      getFeed: builder.getFeed.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeed(input.feedId));
      }),

      getFeedItems: builder.getFeedItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedItems(input.feedId));
      }),

      getFeedItem: builder.getFeedItem.handler(async ({ input, errors }) => {
        const [item, feed] = await Effect.runPromise(
          Effect.all([
            context.service.getFeedItem(input.feedId, input.itemId),
            context.service.getFeed(input.feedId)
          ])
        );

        if (!feed) {
          throw errors.NOT_FOUND({
            message: `Feed ${input.feedId} not found`
          });
        }

        return {
          item,
          feedTitle: feed.options.title
        };
      }),

      getAllFeedItems: builder.getAllFeedItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getAllFeedItems(input || {}));
      }),

      getAllCategories: builder.getAllCategories.handler(async () => {
        return await Effect.runPromise(context.service.getAllCategories());
      }),

      getItemsByCategory: builder.getItemsByCategory.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getItemsByCategory(input.category, input));
      }),

      getFeedsByCategory: builder.getFeedsByCategory.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedsByCategory(input.category));
      }),

      addFeed: builder.addFeed.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.addFeed(input));
      }),

      addFeedItem: builder.addFeedItem.handler(async ({ input }) => {
        const itemWithId = { ...input.item, id: crypto.randomUUID() };
        return await Effect.runPromise(context.service.addFeedItem(input.feedId, itemWithId));
      }),

      deleteFeed: builder.deleteFeed.handler(async ({ input }) => {
        await Effect.runPromise(context.service.deleteFeed(input.feedId));
        return {
          success: true,
          message: `Feed ${input.feedId} successfully deleted`,
        };
      }),

      getTrendingItems: builder.getTrendingItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getTrendingItems(input.timeWindow, input));
      }),

      getFeedTrending: builder.getFeedTrending.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedTrending(input.feedId, input.timeWindow, input));
      }),

      trackItemView: builder.trackItemView.handler(async ({ input }) => {
        await Effect.runPromise(context.service.trackItemView(input.itemId));
        return { success: true };
      }),

      getFeedRss: builder.getFeedRss.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedRss(input.feedId));
      }),

      getFeedAtom: builder.getFeedAtom.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedAtom(input.feedId));
      }),

      getStats: builder.getStats.handler(async () => {
        return await Effect.runPromise(context.service.getStats());
      }),
    };
  },
});
