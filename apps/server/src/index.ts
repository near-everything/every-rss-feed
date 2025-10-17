import { RPCHandler } from "@orpc/server/fetch";
import { Effect, Layer, Config } from "effect";
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { DatabaseService } from "./services/database.service";
import { PluginRuntimeService } from "./services/plugin-runtime.service";
import { createAppRouter } from "./routers";

const program = Effect.gen(function* () {
  yield* Effect.logInfo("🚀 Starting server...");

  const app = new Hono();

  app.use(logger());
  app.use(
    "/*",
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") || ["*"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

  const router = yield* createAppRouter;
  const handler = new RPCHandler(router);

  app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: '/rpc',
      context: await createContext({ context: c })
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

  return app;
});

const AppLayer = Layer.mergeAll(
  DatabaseService.Default,
  PluginRuntimeService.Default
);

export default await Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
    Effect.scoped
  )
);
