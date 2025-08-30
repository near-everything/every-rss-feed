import type { FeedItem as IFeedItem } from "../../../../server/src/schemas/feed";
import { Link, useParams } from "@tanstack/react-router";
import { Author } from "./author";
import { Categories } from "./category";
import { Enclosure } from "./enclosure";

interface ItemProps {
  data: IFeedItem;
  index: number;
}

export function Item({ data, index }: ItemProps) {
  const params = useParams({ from: "/_layout/$feedId/" });
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getImageUrl = (image: string | { url: string } | undefined) => {
    if (!image) return null;
    return typeof image === 'string' ? image : image.url;
  };

  const normalizeId = (str: string) => 
    str.toLowerCase()
       .replace(/[^a-z0-9\s-]/g, '')
       .replace(/\s+/g, '-')
       .replace(/-+/g, '-')
       .replace(/^-|-$/g, '');

  return (
    <article className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Image */}
      {getImageUrl(data?.image) && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={getImageUrl(data?.image)!}
            alt={data.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-6">
        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {data.title}
          </a>
        </h2>

        {/* Author and Date */}
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
          {data.author && data.author[0] && (
            <Author author={data.author[0]} />
          )}
          <time dateTime={data.date}>
            {formatDate(data.date)}
          </time>
        </div>

        {/* Categories */}
        {data.category && data.category.length > 0 && (
          <div className="mb-3">
            <Categories categories={data.category} variant="small" maxDisplay={3} />
          </div>
        )}

        {/* Description */}
        {data.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
            {data.description}
          </p>
        )}

        {/* Media Controls */}
        <div className="space-y-3">
          {/* Audio */}
          {data.audio && (
            <Enclosure 
              enclosure={typeof data.audio === 'string' ? { url: data.audio } : data.audio} 
              type="audio" 
            />
          )}

          {/* Video */}
          {data.video && (
            <Enclosure 
              enclosure={typeof data.video === 'string' ? { url: data.video } : data.video} 
              type="video" 
            />
          )}

          {/* General Enclosure */}
          {data.enclosure && (
            <Enclosure enclosure={data.enclosure} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-3">
            <Link
              to="/$feedId/$itemId"
              params={{ 
                feedId: params.feedId,
                itemId: normalizeId(data.title)
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              View Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              External Link
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          
          {data.published && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Published: {formatDate(data.published)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
