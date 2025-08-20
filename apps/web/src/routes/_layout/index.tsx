import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/")({
  component: HomeComponent,
  loader: async ({ context }) => {
    const queryOptions = context.trpc.getFeeds.queryOptions();
    return context.queryClient.ensureQueryData(queryOptions);
  },
});

function HomeComponent() {
  const { trpc } = Route.useRouteContext();

  const initialData = Route.useLoaderData();

  const queryOptions = trpc.getFeeds.queryOptions();

  const { data: feedsData, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
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

  if (!feedsData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">No feeds available</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          {feedsData.options.image && (
            <img
              src={feedsData.options.image}
              alt={feedsData.options.title}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {feedsData.options.title}
            </h1>
            {feedsData.options.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {feedsData.options.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feed Cards */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Available Feeds ({feedsData.items.length})
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {feedsData.items.map((feed) => (
            <div
              key={feed.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {feed.title}
                </h3>
                {feed.description && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {feed.description}
                  </p>
                )}
                {feed.content && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 line-clamp-2">
                    {feed.content}
                  </p>
                )}
                <Link
                  to="/$feedId"
                  params={{ feedId: feed.id! }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  View Feed
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {feedsData.options.copyright && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          {feedsData.options.copyright}
        </div>
      )}
    </div>
  );
}
