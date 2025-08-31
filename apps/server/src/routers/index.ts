import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";
import {
  publicProcedure,
  protectedProcedure,
  router
} from "../lib/trpc";
import { Feed, FeedItem } from "../schemas/feed";
import { 
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
  RedisError 
} from "../lib/redis";
import { generateRssXml, generateAtomXml } from "../lib/feed-generator";
import { runtime } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  getFeeds: publicProcedure
    .output(z.array(Feed))
    .query(async () => {
      try {
        const feeds = await runtime.runPromise(getFeeds());
        return feeds;
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
          message: `Failed to get feeds: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeed: publicProcedure
    .input(z.object({ feedId: z.string() }))
    .output(Feed.nullable())
    .query(async ({ input }) => {
      const { feedId } = input;
      
      try {
        const feed = await runtime.runPromise(getFeed(feedId));
        return feed;
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
          message: `Failed to get feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedItems: publicProcedure
    .input(z.object({ feedId: z.string() }))
    .output(z.array(FeedItem))
    .query(async ({ input }) => {
      const { feedId } = input;
      
      try {
        const items = await runtime.runPromise(getFeedItems(feedId));
        return items;
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
          message: `Failed to get feed items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedItem: publicProcedure
    .input(z.object({
      feedId: z.string(),
      itemId: z.string()
    }))
    .output(z.object({
      item: FeedItem.nullable(),
      feedTitle: z.string()
    }))
    .query(async ({ input }) => {
      const { feedId, itemId } = input;

      try {
        const [item, feed] = await runtime.runPromise(
          Effect.all([
            getFeedItem(feedId, itemId),
            getFeed(feedId)
          ])
        );

        if (!feed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Feed ${feedId} not found`,
          });
        }

        return {
          item,
          feedTitle: feed.options.title
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
          message: `Failed to get feed item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  addFeed: protectedProcedure
    .input(Feed)
    .output(z.object({
      success: z.boolean(),
      feedId: z.string(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const feedId = await runtime.runPromise(addFeed(input));

        return {
          success: true,
          feedId,
          message: `Feed ${feedId} successfully created`,
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
          message: `Failed to add feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  addFeedItem: protectedProcedure
    .input(z.object({
      feedId: z.string().min(1, "Feed ID is required"),
      item: FeedItem.omit({ id: true })
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
    }),
  deleteFeed: protectedProcedure
    .input(z.object({ feedId: z.string() }))
    .output(z.object({
      success: z.boolean(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { feedId } = input;

      try {
        await runtime.runPromise(deleteFeed(feedId));

        return {
          success: true,
          message: `Feed ${feedId} successfully deleted`,
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
          message: `Failed to delete feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedRss: publicProcedure
    .input(z.object({ feedId: z.string() }))
    .output(z.string())
    .query(async ({ input }) => {
      const { feedId } = input;
      
      try {
        const feed = await runtime.runPromise(getFeed(feedId));
        
        if (!feed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Feed ${feedId} not found`,
          });
        }

        const baseUrl = process.env.BASE_URL || "http://localhost:1337";
        return generateRssXml(feed, baseUrl);
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
          message: `Failed to generate RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedAtom: publicProcedure
    .input(z.object({ feedId: z.string() }))
    .output(z.string())
    .query(async ({ input }) => {
      const { feedId } = input;
      
      try {
        const feed = await runtime.runPromise(getFeed(feedId));
        
        if (!feed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Feed ${feedId} not found`,
          });
        }

        const baseUrl = process.env.BASE_URL || "http://localhost:1337";
        return generateAtomXml(feed, baseUrl);
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
          message: `Failed to generate Atom feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getAllFeedItems: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      since: z.string().optional(),
    }))
    .output(z.array(FeedItem))
    .query(async ({ input }) => {
      const { limit, offset, since } = input;
      
      try {
        const items = await runtime.runPromise(
          getAllFeedItems({ limit, offset, since })
        );
        return items;
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
          message: `Failed to get all feed items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getAllCategories: publicProcedure
    .output(z.array(z.string()))
    .query(async () => {
      try {
        const categories = await runtime.runPromise(getAllCategories());
        return categories;
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
          message: `Failed to get all categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getItemsByCategory: publicProcedure
    .input(z.object({
      category: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .output(z.array(FeedItem))
    .query(async ({ input }) => {
      const { category, limit, offset } = input;
      
      try {
        const items = await runtime.runPromise(
          getItemsByCategory(category, { limit, offset })
        );
        return items;
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
          message: `Failed to get items by category: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedsByCategory: publicProcedure
    .input(z.object({ category: z.string().min(1) }))
    .output(z.array(Feed))
    .query(async ({ input }) => {
      const { category } = input;
      
      try {
        const feeds = await runtime.runPromise(getFeedsByCategory(category));
        return feeds;
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
          message: `Failed to get feeds by category: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getTrendingItems: publicProcedure
    .input(z.object({
      timeWindow: z.enum(['1h', '24h', '7d', '30d']),
      limit: z.number().min(1).max(50).default(10),
    }))
    .output(z.array(FeedItem))
    .query(async ({ input }) => {
      const { timeWindow, limit } = input;
      
      try {
        const items = await runtime.runPromise(
          getTrendingItems(timeWindow, { limit })
        );
        return items;
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
          message: `Failed to get trending items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getFeedTrending: publicProcedure
    .input(z.object({
      feedId: z.string().min(1),
      timeWindow: z.enum(['1h', '24h', '7d', '30d']),
      limit: z.number().min(1).max(50).default(10),
    }))
    .output(z.array(FeedItem))
    .query(async ({ input }) => {
      const { feedId, timeWindow, limit } = input;
      
      try {
        const items = await runtime.runPromise(
          getFeedTrending(feedId, timeWindow, { limit })
        );
        return items;
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
          message: `Failed to get feed trending items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  trackItemView: publicProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const { itemId } = input;
      
      try {
        await runtime.runPromise(trackItemView(itemId));
        return { success: true };
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
          message: `Failed to track item view: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
  getStats: publicProcedure
    .output(z.object({
      totalFeeds: z.number(),
      totalItems: z.number(),
      totalCategories: z.number(),
    }))
    .query(async () => {
      try {
        const stats = await runtime.runPromise(getStats());
        return stats;
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
          message: `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    })
});

export type AppRouter = typeof appRouter;
