import { Feed } from "@/components/feed";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

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
        <div className="text-center">No feed data available</div>
      </div>
    );
  }

  return <Feed data={data} />;
}
