import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";

export const createRssAuthClient = (baseURL: string) => {
  return createAuthClient({
    baseURL,
    plugins: [
      apiKeyClient(),
    ],
  });
};

export type RssAuthClient = ReturnType<typeof createRssAuthClient>;
