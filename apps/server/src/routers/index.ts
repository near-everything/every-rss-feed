import { betterFetch } from '@better-fetch/fetch';
import BunCache from "@samocodes/bun-cache";
import { z } from "zod";
import {
  protectedProcedure, publicProcedure,
  router,
} from "../lib/trpc";
import { Feed } from "../schemas/feed";

const cache = new BunCache(false);

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "hello world!",
      user: ctx.session.user,
    };
  }),
  getRssFeed: publicProcedure
    .input(z.object({ feedId: z.string().optional() }).optional())
    .output(Feed)
    .query(async ({ input }) => {
      const feedId = input?.feedId ?? 'grants';
      const cacheKey = `rss-feed-${feedId}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Fetch from RSS service
      const url = `https://rss.curate.fun/${feedId}/feed.json`;
      const { data, error } = await betterFetch(url);

      if (error) {
        throw new Error(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Cache for 5 minutes (300,000ms)
      cache.put(cacheKey, JSON.stringify(data), 300000);

      return data;
    })
});

export type AppRouter = typeof appRouter;
