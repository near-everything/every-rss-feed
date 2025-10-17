import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";

export const Route = createFileRoute("/_layout/$feedId/$itemId")({
  component: ItemPage,
  loader: async ({ context, params }) => {
    const queryOptions = context.orpc.rss.getFeedItem.queryOptions({ input: params });
    return context.queryClient.ensureQueryData(queryOptions);
  },
  pendingComponent: () => <div>Loading item...</div>,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const queryErrorResetBoundary = useQueryErrorResetBoundary();

    useEffect(() => {
      queryErrorResetBoundary.reset();
    }, [queryErrorResetBoundary]);

    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Failed to load item</h2>
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

function ItemPage() {
  const { feedId, itemId } = Route.useParams();
  const { orpc } = Route.useRouteContext();

  const initialData = Route.useLoaderData();

  const queryOptions = orpc.rss.getFeedItem.queryOptions({ input: { feedId, itemId } });

  const { data, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
  });

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading article: {error.message}
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
          <Link
            to="/$feedId"
            params={{ feedId }}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          >
            Back to Feed
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Item Data</span>
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Feed Item
        </h1>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}
