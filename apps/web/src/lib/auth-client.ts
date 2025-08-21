import { createAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL,
  plugins: [
    siwnClient({
      domain: "curate-news-feed.near",
    }),
  ],
});
