import type { FeedCategory as IFeedCategory } from "../../../../server/src/schemas/feed";

interface CategoryProps {
  category: IFeedCategory;
  variant?: 'default' | 'small';
}

export function Category({ category, variant = 'default' }: CategoryProps) {
  const baseClasses = "font-medium rounded-full transition-colors";
  const variantClasses = variant === 'small' 
    ? "px-2 py-1 text-xs" 
    : "px-3 py-1 text-sm";
  
  const colorClasses = "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800";

  const content = (
    <span className={`${baseClasses} ${variantClasses} ${colorClasses}`}>
      {category.name}
    </span>
  );

  if (category.scheme) {
    return (
      <a
        href={category.scheme}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        {content}
      </a>
    );
  }

  return content;
}

interface CategoriesProps {
  categories: IFeedCategory[];
  variant?: 'default' | 'small';
  maxDisplay?: number;
}

export function Categories({ categories, variant = 'default', maxDisplay }: CategoriesProps) {
  const displayCategories = maxDisplay ? categories.slice(0, maxDisplay) : categories;
  const remainingCount = maxDisplay && categories.length > maxDisplay ? categories.length - maxDisplay : 0;

  return (
    <div className="flex flex-wrap gap-2">
      {displayCategories.map((category, idx) => (
        <Category key={idx} category={category} variant={variant} />
      ))}
      {remainingCount > 0 && (
        <span className={`${variant === 'small' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400`}>
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
