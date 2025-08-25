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

  async getFeedDirectory() {
    return this.trpcClient.getFeeds.query();
  }

  async getFeed(feedId?: string) {
    return this.trpcClient.getFeed.query({ feedId });
  }

  async getFeedItem(feedId: string, itemId: string) {
    return this.trpcClient.getFeedItem.query({ feedId, itemId });
  }

  // Bulk operations for efficiency
  async getFeeds(feedIds: string[]) {
    return Promise.all(feedIds.map(id => this.getFeed(id)));
  }

  async getFeedItems(requests: Array<{ feedId: string; itemId: string }>) {
    return Promise.all(
      requests.map(({ feedId, itemId }) => this.getFeedItem(feedId, itemId))
    );
  }
}
