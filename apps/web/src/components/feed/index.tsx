import type { Feed as IFeed } from "../../../../server/src/schemas/feed";
import { Item } from "./item";

interface FeedProps {
  data: IFeed;
}

export function Feed({ data }: FeedProps) {
  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-6">RSS Feed</h1>
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-2">{data.title}</h2>
        {data.description && (
          <p className="text-gray-600 dark:text-gray-400">{data.description}</p>
        )}
      </div>
      <div className="space-y-4">
        {data.items?.map((item, index) => (
          <Item key={item.id || index} data={item} index={index} />
        ))}
      </div>
    </div>
  );
}
