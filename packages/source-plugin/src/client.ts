import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../apps/server/src/routers";
import { type RssAuthClient, createRssAuthClient } from "./auth-client";

export class RssClient {
  private trpcClient: ReturnType<typeof createTRPCClient<AppRouter>>;
  private authClient: RssAuthClient;

  constructor(baseUrl: string, apiKey: string) {
    this.trpcClient = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
          headers: {
            "x-api-key": apiKey,
          },
        }),
      ],
    });

    this.authClient = createRssAuthClient(baseUrl);
  }

  async healthCheck(): Promise<string> {
    return this.trpcClient.healthCheck.query();
  }

  async getFeeds() {
    return this.trpcClient.getFeeds.query();
  }

  async getFeed(feedId: string) {
    return this.trpcClient.getFeed.query({ feedId });
  }

  async getFeedItem(feedId: string, itemId: string) {
    return this.trpcClient.getFeedItem.query({ feedId, itemId });
  }

  async getFeedItems(feedId: string) {
    return this.trpcClient.getFeedItems.query({ feedId });
  }

  // Cross-feed aggregation methods
  async getAllFeedItems(limit?: number) {
    return this.trpcClient.getAllFeedItems.query({ limit });
  }

  async getAllCategories() {
    return this.trpcClient.getAllCategories.query();
  }

  async getItemsByCategory(category: string, limit?: number) {
    return this.trpcClient.getItemsByCategory.query({ category, limit });
  }

  async getFeedsByCategory(category: string) {
    return this.trpcClient.getFeedsByCategory.query({ category });
  }

  // Trending methods
  async getTrendingItems(timeWindow: "1h" | "24h" | "7d" | "30d", limit?: number) {
    return this.trpcClient.getTrendingItems.query({ timeWindow, limit });
  }

  async getFeedTrending(feedId: string, timeWindow: "1h" | "24h" | "7d" | "30d", limit?: number) {
    return this.trpcClient.getFeedTrending.query({ feedId, timeWindow, limit });
  }
  
  // Bulk operations for efficiency
  async getFeedsBulk(feedIds: string[]) {
    return Promise.all(feedIds.map(id => this.getFeed(id)));
  }

  async getFeedItemsBulk(requests: Array<{ feedId: string; itemId: string }>) {
    return Promise.all(
      requests.map(({ feedId, itemId }) => this.getFeedItem(feedId, itemId))
    );
  }
}
