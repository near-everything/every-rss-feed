import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/$feedId/")({
  component: FeedPage,
  loader: async ({ context, params }) => {
    const queryOptions = context.trpc.getFeed.queryOptions(params);
    return context.queryClient.ensureQueryData(queryOptions);
  },
});

function FeedPage() {
  const { feedId } = Route.useParams();
  const { trpc } = Route.useRouteContext();

  const initialData = Route.useLoaderData();

  const queryOptions = trpc.getFeed.queryOptions({ feedId });

  const { data, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
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
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Feed Data</span>
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Feed Data Structure
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This shows the exact data structure received from the getFeed TRPC endpoint:
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}
