import { Effect, Config } from "effect";
import { createPluginRuntime } from "every-plugin/runtime";
import { pluginRegistry } from "../lib/registry";
import type { PluginBinding } from "every-plugin";
import type RssPlugin from "@curatedotfun/rss-plugin";

type AppBindings = {
  "@curatedotfun/rss-plugin": PluginBinding<typeof RssPlugin>;
};

export class PluginRuntimeService extends Effect.Service<PluginRuntimeService>()(
  "PluginRuntimeService",
  {
    accessors: true,
    scoped: Effect.gen(function* () {
      const redisUrl = yield* Config.string("REDIS_URL").pipe(
        Effect.orElse(() => Effect.succeed("redis://localhost:6379"))
      );

      const runtime = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createPluginRuntime<AppBindings>({
            registry: pluginRegistry,
            secrets: { REDIS_URL: redisUrl }
          })
        ),
        (runtime) => Effect.promise(() => runtime.shutdown())
      );

      return runtime;
    }),
    dependencies: [],
  }
) {}
