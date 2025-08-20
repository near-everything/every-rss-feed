import { useTRPC } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Feed } from "@/components/feed";

export const Route = createFileRoute("/_layout/")({
  component: HomeComponent,
});

function HomeComponent() {
  const trpc = useTRPC();
  const { data: feedData, isLoading, error } = useQuery(trpc.getRssFeed.queryOptions({ feedId: "usa" }));

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading RSS feed...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading RSS feed: {error.message}
        </div>
      </div>
    );
  }

  if (!feedData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">No feed data available</div>
      </div>
    );
  }

  return <Feed data={feedData} />;
}
