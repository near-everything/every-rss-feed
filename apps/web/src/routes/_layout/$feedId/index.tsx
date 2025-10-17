import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { generateFakeFeedItem } from "@/utils/faker-data";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { orpc, client } from "@/utils/orpc";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";

export const Route = createFileRoute("/_layout/$feedId/")({
  component: FeedPage,
  loader: async ({ context, params }) => {
    const queryOptions = context.orpc.rss.getFeed.queryOptions({ input: params });
    return context.queryClient.ensureQueryData(queryOptions);
  },
  pendingComponent: () => <div>Loading feed...</div>,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const queryErrorResetBoundary = useQueryErrorResetBoundary();

    useEffect(() => {
      queryErrorResetBoundary.reset();
    }, [queryErrorResetBoundary]);

    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Failed to load feed</h2>
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

function FeedPage() {
  const { feedId } = Route.useParams();
  const { orpc, queryClient } = Route.useRouteContext();
  const navigate = useNavigate();

  const initialData = Route.useLoaderData();

  const queryOptions = orpc.rss.getFeed.queryOptions({ input: { feedId } });

  const { data, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
  });

  const { data: session } = authClient.useSession();

  const addFeedItemMutation = useMutation({
    mutationFn: async () => {
      const fakeItem = generateFakeFeedItem();
      await client.rss.addFeedItem({ feedId, item: fakeItem });
      return;
    },
    onSuccess: () => {
      toast.success('Feed item added successfully!');
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    },
    onError: (error: any) => {
      toast.error(`Failed to add feed item: ${error.message}`);
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async () => {
      await client.rss.deleteFeed({ feedId });
      return;
    },
    onSuccess: () => {
      toast.success('Feed deleted successfully!');
      queryClient.invalidateQueries({ queryKey: orpc.rss.getFeeds.queryOptions().queryKey });
      navigate({ to: '/' });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete feed: ${error.message}`);
    },
  });

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading RSS feed: {error.message}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Feed Data</span>
        </nav>
      </div>

      {/* Feed Actions */}
      {session && (
        <div className="flex gap-4">
          <Button
            onClick={() => addFeedItemMutation.mutate()}
            disabled={addFeedItemMutation.isPending}
          >
            {addFeedItemMutation.isPending ? 'Adding...' : 'Add Feed Item'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteFeedMutation.mutate()}
            disabled={deleteFeedMutation.isPending}
          >
            {deleteFeedMutation.isPending ? 'Deleting...' : 'Delete Feed'}
          </Button>
        </div>
      )}

      {/* Full Feed Data */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Feed
        </h1>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
          <code>{JSON.stringify(data.options, null, 2)}</code>
        </pre>
      </div>

      {/* Feed Items */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Items ({data.items.length})
        </h2>
        {data.items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Feed Item
              </h3>
              {item.id && (
                <Link
                  to="/$feedId/$itemId"
                  params={{ feedId, itemId: item.id }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  View Item
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
              <code>{JSON.stringify(item, null, 2)}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
