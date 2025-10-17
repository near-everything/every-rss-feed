import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { generateFakeFeed } from "@/utils/faker-data";
import { orpc, client } from "@/utils/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/")({
  component: HomeComponent,
  loader: async ({ context }) => {
    const queryOptions = context.orpc.rss.getFeeds.queryOptions();
    return context.queryClient.ensureQueryData(queryOptions);
  },
  pendingComponent: () => <div>Loading feeds...</div>,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const queryErrorResetBoundary = useQueryErrorResetBoundary();

    useEffect(() => {
      queryErrorResetBoundary.reset();
    }, [queryErrorResetBoundary]);

    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Failed to load feeds</h2>
          <p className="mb-4 text-red-600">{error.message}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.invalidate()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
});

function HomeComponent() {
  const { orpc, queryClient } = Route.useRouteContext();

  const initialData = Route.useLoaderData();

  const queryOptions = orpc.rss.getFeeds.queryOptions();

  const { data: feeds, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
  });

  const { data: session } = authClient.useSession();

  const addFeedMutation = useMutation({
    mutationFn: async () => {
      const fakeFeed = generateFakeFeed();
      await client.rss.addFeed(fakeFeed);
      return;
    },
    onSuccess: () => {
      toast.success("Feed added successfully!");
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    },
    onError: (error: any) => {
      toast.error(`Failed to add feed: ${error.message}`);
    },
  });

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading feeds: {error.message}
        </div>
      </div>
    );
  }

  if (!feeds) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            RSS Feed Reader
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            No feeds available at the moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            RSS Feed Reader
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and read example RSS feeds
          </p>
        </div>
      </div>

      {/* Feed Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Available Feeds ({feeds.length})
          </h2>
          {session && (
            <Button
              onClick={() => addFeedMutation.mutate()}
              disabled={addFeedMutation.isPending}
            >
              {addFeedMutation.isPending ? "Adding..." : "Add New Feed"}
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {feeds.map((feed) => (
            <div
              key={feed.options.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Feed Options Data
                </h3>
                <Link
                  to="/$feedId"
                  params={{ feedId: feed.options.id }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  View Feed
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
                <code>{JSON.stringify(feed.options, null, 2)}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
