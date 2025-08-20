import { Author } from "@/components/feed/author";
import { Categories } from "@/components/feed/category";
import { Enclosure } from "@/components/feed/enclosure";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/$feedId/$itemId")({
  component: ItemPage,
  loader: async ({ context, params }) => {
    const queryOptions = context.trpc.getFeedItem.queryOptions(params);
    return context.queryClient.ensureQueryData(queryOptions);
  },
});

function ItemPage() {
  const { feedId, itemId } = Route.useParams();
  const { trpc } = Route.useRouteContext();

  const initialData = Route.useLoaderData();

  const queryOptions = trpc.getFeedItem.queryOptions({ feedId, itemId });

  const { data, error } = useQuery({
    ...queryOptions,
    initialData: initialData,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getImageUrl = (image: string | { url: string } | undefined) => {
    if (!image) return null;
    return typeof image === "string" ? image : image.url;
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading article: {error.message}
        </div>
      </div>
    );
  }

  if (!data?.item) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Article Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The article you're looking for could not be found.
          </p>
          <Link
            to="/$feedId"
            params={{ feedId }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  const item = data.item;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Navigation */}
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
            {data.feedTitle}
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">{item.title}</span>
        </nav>
      </div>

      {/* Article */}
      <article className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Hero Image */}
        {getImageUrl(item.image) && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={getImageUrl(item.image)!}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-8">
          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {item.title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6 pb-6 border-b border-gray-200 dark:border-gray-600">
            {item.author && item.author[0] && (
              <Author author={item.author[0]} />
            )}
            <time dateTime={item.date}>{formatDate(item.date)}</time>
            {item.published && (
              <span>Published: {formatDate(item.published)}</span>
            )}
          </div>

          {/* Categories */}
          {item.category && item.category.length > 0 && (
            <div className="mb-6">
              <Categories categories={item.category} variant="default" />
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="mb-6">
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {item.description}
              </p>
            </div>
          )}

          {/* Content */}
          {item.content && (
            <div className="mb-8">
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
            </div>
          )}

          {/* Media */}
          <div className="space-y-4 mb-8">
            {item.audio && (
              <Enclosure
                enclosure={
                  typeof item.audio === "string"
                    ? { url: item.audio }
                    : item.audio
                }
                type="audio"
              />
            )}
            {item.video && (
              <Enclosure
                enclosure={
                  typeof item.video === "string"
                    ? { url: item.video }
                    : item.video
                }
                type="video"
              />
            )}
            {item.enclosure && <Enclosure enclosure={item.enclosure} />}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-600">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Read Original Article
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            <Link
              to="/$feedId"
              params={{ feedId }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
            >
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Feed
            </Link>
          </div>

          {/* Copyright */}
          {item.copyright && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {item.copyright}
              </p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
