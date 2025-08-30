
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { siwn } from "better-near-auth";
import { db } from "../db";
import * as schema from "../db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: process.env.CORS_ORIGIN?.split(",") || ["*"],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    siwn({
      recipient: "every-news-feed.near"
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes cache - reduces DB hits
    }
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none", // need this to allow many clients
      secure: true,
      partitioned: true
    }
  }
});