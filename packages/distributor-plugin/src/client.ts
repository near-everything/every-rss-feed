import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../apps/server/src/routers";
import { type RssAuthClient, createRssAuthClient } from "./auth-client";
import type { FeedItem } from "../../../apps/server/src/schemas/feed";

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

  async addFeedItem(feedId: string, item: Omit<FeedItem, 'id'>): Promise<{
    success: boolean;
    itemId: string;
    message?: string;
  }> {
    return this.trpcClient.addFeedItem.mutate({
      feedId,
      item,
    });
  }

}
