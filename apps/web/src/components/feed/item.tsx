import type { FeedItem as IFeedItem } from "../../../../server/src/schemas/feed";

interface ItemProps {
  data: IFeedItem;
  index: number;
}

export function Item({ data, index }: ItemProps) {
  return (
    <div
      key={data.id || index}
      className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
