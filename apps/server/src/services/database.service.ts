import { Effect, Context, Data, Config } from "effect";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
}> {}

export class DatabaseService extends Effect.Service<DatabaseService>()(
  "DatabaseService",
  {
    accessors: true,
    scoped: Effect.gen(function* () {
      const connectionUrl = yield* Config.string("TURSO_CONNECTION_URL").pipe(
        Config.orElse(() => Config.succeed("file:./database.db"))
      );

      const authToken = yield* Config.option(Config.string("DATABASE_AUTH_TOKEN"));

      const client = yield* Effect.acquireRelease(
        Effect.sync(() => createClient({
          url: connectionUrl,
          authToken: authToken._tag === "Some" ? authToken.value : undefined,
        })),
        (client) => Effect.sync(() => client.close())
      );

      const db = drizzle(client);

      // Test connection
      yield* Effect.tryPromise({
        try: () => client.execute("SELECT 1"),
        catch: (error) => new DatabaseError({ cause: error }),
      });

      // Run migrations
      yield* Effect.tryPromise({
        try: () =>
          migrate(db, {
            migrationsFolder: "./migrations",
          }),
        catch: (error) => new DatabaseError({ cause: error }),
      });

      return { db, client };
    }),
    dependencies: [],
  }
) {}
