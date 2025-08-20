import type { FeedAuthor as IFeedAuthor } from "../../../../server/src/schemas/feed";

interface AuthorProps {
  author: IFeedAuthor;
  showEmail?: boolean;
}

export function Author({ author, showEmail = false }: AuthorProps) {
  return (
    <div className="flex items-center gap-2">
      {author.avatar && (
        <img
          src={author.avatar}
          alt={author.name || 'Author'}
          className="w-6 h-6 rounded-full"
        />
      )}
      <div className="flex flex-col">
        {author.link ? (
          <a
            href={author.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {author.name}
          </a>
        ) : (
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {author.name}
          </span>
        )}
        {showEmail && author.email && (
          <a
            href={`mailto:${author.email}`}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {author.email}
          </a>
        )}
      </div>
    </div>
  );
}
