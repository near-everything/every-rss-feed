import { Effect } from "effect";
import { protectedProcedure, publicProcedure } from "../lib/orpc";
import { PluginRuntimeService } from "../services/plugin-runtime.service";

export const createAppRouter = Effect.gen(function* () {
  const runtime = yield* PluginRuntimeService;

  const { router: rssRouter } = yield* Effect.promise(() =>
    runtime.usePlugin("@curatedotfun/rss-plugin", {
      variables: {
        timeout: 10000
      },
      secrets: { redisUrl: "{{REDIS_URL}}" }
    })
  );

  return publicProcedure.router({
    healthCheck: publicProcedure.handler(() => {
      return "OK";
    }),
    rss: {
      // Public read operations
      ...rssRouter,
      // healthCheck: rssRouter.healthCheck,
      // getFeeds: rssRouter.getFeeds,
      // getFeed: rssRouter.getFeed,
      // getFeedItems: rssRouter.getFeedItems,
      // getFeedItem: rssRouter.getFeedItem,
      // getAllFeedItems: rssRouter.getAllFeedItems,
      // getAllCategories: rssRouter.getAllCategories,
      // getItemsByCategory: rssRouter.getItemsByCategory,
      // getFeedsByCategory: rssRouter.getFeedsByCategory,
      // getTrendingItems: rssRouter.getTrendingItems,
      // getFeedTrending: rssRouter.getFeedTrending,
      // trackItemView: rssRouter.trackItemView,
      // getFeedRss: rssRouter.getFeedRss,
      // getFeedAtom: rssRouter.getFeedAtom,
      // getStats: rssRouter.getStats,

      // Protected write operations
      ...protectedProcedure.router({
        addFeed: rssRouter.addFeed,
        addFeedItem: rssRouter.addFeedItem,
        deleteFeed: rssRouter.deleteFeed,
      })
    }
  });
});
