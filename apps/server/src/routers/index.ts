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
  RedisError 
} from "../lib/redis";
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
    })
});

export type AppRouter = typeof appRouter;
