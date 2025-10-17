import { CommonPluginErrors } from "every-plugin";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { Feed, FeedItem } from "./schemas/feed";

// oRPC Contract definition for RSS plugin
export const contract = oc.router({
  // Health check
  healthCheck: oc
    .route({ method: 'GET', path: '/health' })
    .output(z.string())
    .errors(CommonPluginErrors),

  // Read operations - Feeds
  getFeeds: oc
    .route({ method: 'GET', path: '/feeds' })
    .output(z.array(Feed))
    .errors(CommonPluginErrors),

  getFeed: oc
    .route({ method: 'GET', path: '/feeds/{feedId}' })
    .input(z.object({ feedId: z.string() }))
    .output(Feed.nullable())
    .errors(CommonPluginErrors),

  getFeedItems: oc
    .route({ method: 'GET', path: '/feeds/{feedId}/items' })
    .input(z.object({ feedId: z.string() }))
    .output(z.array(FeedItem))
    .errors(CommonPluginErrors),

  getFeedItem: oc
    .route({ method: 'GET', path: '/feeds/{feedId}/items/{itemId}' })
    .input(z.object({
      feedId: z.string(),
      itemId: z.string()
    }))
    .output(z.object({
      item: FeedItem.nullable(),
      feedTitle: z.string()
    }))
    .errors(CommonPluginErrors),

  // Aggregation operations
  getAllFeedItems: oc
    .route({ method: 'GET', path: '/items' })
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      since: z.string().optional(),
    }).optional())
    .output(z.array(FeedItem))
    .errors(CommonPluginErrors),

  getAllCategories: oc
    .route({ method: 'GET', path: '/categories' })
    .output(z.array(z.string()))
    .errors(CommonPluginErrors),

  getItemsByCategory: oc
    .route({ method: 'GET', path: '/categories/{category}/items' })
    .input(z.object({
      category: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .output(z.array(FeedItem))
    .errors(CommonPluginErrors),

  getFeedsByCategory: oc
    .route({ method: 'GET', path: '/categories/{category}/feeds' })
    .input(z.object({ category: z.string().min(1) }))
    .output(z.array(Feed))
    .errors(CommonPluginErrors),

  // Write operations
  addFeed: oc
    .route({ method: 'POST', path: '/feeds' })
    .input(Feed)
    .output(z.string())
    .errors(CommonPluginErrors),

  addFeedItem: oc
    .route({ method: 'POST', path: '/feeds/{feedId}/items' })
    .input(z.object({
      feedId: z.string().min(1),
      item: FeedItem.omit({ id: true })
    }))
    .output(z.string())
    .errors(CommonPluginErrors),

  deleteFeed: oc
    .route({ method: 'DELETE', path: '/feeds/{feedId}' })
    .input(z.object({ feedId: z.string() }))
    .output(z.object({
      success: z.boolean(),
      message: z.string().optional(),
    }))
    .errors(CommonPluginErrors),

  // Trending operations
  getTrendingItems: oc
    .route({ method: 'GET', path: '/trending' })
    .input(z.object({
      timeWindow: z.enum(['1h', '24h', '7d', '30d']),
      limit: z.number().min(1).max(50).default(10),
    }))
    .output(z.array(FeedItem))
    .errors(CommonPluginErrors),

  getFeedTrending: oc
    .route({ method: 'GET', path: '/feeds/{feedId}/trending' })
    .input(z.object({
      feedId: z.string().min(1),
      timeWindow: z.enum(['1h', '24h', '7d', '30d']),
      limit: z.number().min(1).max(50).default(10),
    }))
    .output(z.array(FeedItem))
    .errors(CommonPluginErrors),

  trackItemView: oc
    .route({ method: 'POST', path: '/items/{itemId}/track-view' })
    .input(z.object({ itemId: z.string().min(1) }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),

  // RSS format operations
  getFeedRss: oc
    .route({ method: 'GET', path: '/feeds/{feedId}/rss' })
    .input(z.object({ feedId: z.string() }))
    .output(z.string())
    .errors(CommonPluginErrors),

  getFeedAtom: oc
    .route({ method: 'GET', path: '/feeds/{feedId}/atom' })
    .input(z.object({ feedId: z.string() }))
    .output(z.string())
    .errors(CommonPluginErrors),

  // Utility operations
  getStats: oc
    .route({ method: 'GET', path: '/stats' })
    .output(z.object({
      totalFeeds: z.number(),
      totalItems: z.number(),
      totalCategories: z.number(),
    }))
    .errors(CommonPluginErrors),
});
