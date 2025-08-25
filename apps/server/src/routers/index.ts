import { betterFetch } from '@better-fetch/fetch';
import BunCache from "@samocodes/bun-cache";
import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";
import {
  publicProcedure,
  protectedProcedure,
  router
} from "../lib/trpc";
import { CurrentFeedToFeed, Feed, FeedItem } from "../schemas/feed";
import { addFeedItem, RedisError } from "../lib/redis";
import { runtime } from "../index";

const cache = new BunCache(false);

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  getFeeds: publicProcedure
    .output(Feed)
    .query(async () => {
      const cacheKey = 'feeds-directory';

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Create feed directory data
      const feedsData: Feed = {
        items: [
          {
            title: "Grants Feed",
            id: "grants",
            link: "/grants",
            date: new Date().toISOString(),
            description: "Funding opportunities and grants for projects and research",
            content: "Stay updated with the latest funding opportunities, grants, and investment news across various sectors.",
            guid: "grants",
          },
          {
            title: "USA News",
            id: "usa",
            link: "/usa",
            date: new Date().toISOString(),
            description: "US political and economic updates",
            content: "Comprehensive coverage of American politics, economics, and policy developments.",
            guid: "usa",
          },
          {
            title: "DeSci Feed",
            id: "desci",
            link: "/desci",
            date: new Date().toISOString(),
            description: "Decentralized science developments and research",
            content: "Latest developments in decentralized science, research funding, and scientific innovation.",
            guid: "desci",
          },
          {
            title: "Solana Updates",
            id: "solana",
            link: "/solana",
            date: new Date().toISOString(),
            description: "Solana ecosystem news and developments",
            content: "News, updates, and developments from the Solana blockchain ecosystem.",
            guid: "solana",
          },
          {
            title: "NEAR Protocol",
            id: "near",
            link: "/near",
            date: new Date().toISOString(),
            description: "NEAR blockchain updates and ecosystem news",
            content: "Latest updates from the NEAR Protocol blockchain and its growing ecosystem.",
            guid: "near",
          },
        ],
        options: {
          id: "curate-feeds",
          title: "curate.fun",
          updated: new Date().toISOString(),
          generator: "Curate News Feed",
          language: "en",
          ttl: 60,
          link: "https://curate.fun",
          description: "Discover curated RSS feeds across various topics and industries",
          image: "https://app.curate.fun/curatedotfuntransparenticon.png",
          favicon: "https://app.curate.fun/curatedotfuntransparenticon.png",
          copyright: `© ${new Date().getFullYear()} curate.fun`,
        },
        categories: ["Technology", "Finance", "Science", "Blockchain", "News"],
        contributors: [],
        extensions: [],
      };

      // Cache for 10 minutes (600,000ms) since this is mostly static
      cache.put(cacheKey, JSON.stringify(feedsData), 600000);

      return feedsData;
    }),
  getFeed: publicProcedure
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

      const transformedData = CurrentFeedToFeed.parse(data);

      // Cache for 5 minutes (300,000ms)
      cache.put(cacheKey, JSON.stringify(transformedData), 300000);

      return transformedData;
    }),
  getFeedItem: publicProcedure
    .input(z.object({
      feedId: z.string(),
      itemId: z.string()
    }))
    .output(z.object({
      item: z.union([Feed.shape.items.element, z.null()]),
      feedTitle: z.string()
    }))
    .query(async ({ input }) => {
      const { feedId, itemId } = input;

      // First get the feed data
      const feedCacheKey = `rss-feed-${feedId}`;
      let feedData: Feed;

      const cached = cache.get(feedCacheKey);
      if (cached) {
        feedData = JSON.parse(cached as string);
      } else {
        // Fetch from RSS service
        const url = `https://rss.curate.fun/${feedId}/feed.json`;
        const { data, error } = await betterFetch(url);

        if (error) {
          throw new Error(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        feedData = CurrentFeedToFeed.parse(data);
        cache.put(feedCacheKey, JSON.stringify(feedData), 300000);
      }

      // Normalize the itemId for comparison (same logic TanStack Router would use)
      const normalizeId = (str: string) =>
        str.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

      const normalizedItemId = normalizeId(itemId);

      // Find the item by comparing normalized titles
      const item = feedData.items.find(item =>
        normalizeId(item.title) === normalizedItemId
      );

      return {
        item: item || null,
        feedTitle: feedData.options.title
      };
    }),
  addFeedItem: protectedProcedure
    .input(z.object({
      feedId: z.string().min(1, "Feed ID is required"),
      item: FeedItem.omit({ id: true }) // ID will be generated server-side
    }))
    .output(z.object({
      success: z.boolean(),
      itemId: z.string(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { feedId, item } = input;

      try {
        const itemWithId = { ...item, id: crypto.randomUUID() };
        
        const itemId = await runtime.runPromise(
          addFeedItem(feedId, itemWithId)
        );

        return {
          success: true,
          itemId,
          message: `Item successfully added to feed ${feedId}`,
        };
      } catch (error) {
        if (error instanceof RedisError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error.cause,
          });
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to add item to feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    })
});

export type AppRouter = typeof appRouter;
