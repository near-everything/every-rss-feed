import { FeedItem } from "../../../apps/server/src/schemas/feed";
import { FeedTemplate } from "./schemas";

/**
 * Simple template engine that replaces {{variable}} placeholders
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Extract category from feed item
 */
export function extractCategory(item: FeedItem): string {
  // Try to get category from item.category array first
  if (item.category && item.category.length > 0) {
    // Use the first category's term or name
    const firstCategory = item.category[0];
    return firstCategory.term || firstCategory.name || "general";
  }
  
  // Fallback to "general" if no category found
  return "general";
}

/**
 * Generate feed ID from category (URL-safe)
 */
export function generateFeedId(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create feed from template using item data
 */
export function createFeedFromTemplate(
  item: FeedItem,
  template: FeedTemplate
): { feedId: string; feed: any } {
  const category = extractCategory(item);
  const feedId = generateFeedId(category);
  
  // Template variables
  const variables = {
    category,
    feedId,
    // Add more variables as needed
    title: item.title || "",
    date: new Date().toISOString(),
  };
  
  const feed = {
    id: feedId,
    options: {
      title: renderTemplate(template.title, variables),
      description: renderTemplate(template.description, variables),
      link: template.link ? renderTemplate(template.link, variables) : `https://example.com/${feedId}`,
      language: template.language,
      category: template.category ? renderTemplate(template.category, variables) : category,
      generator: "RSS Distributor Plugin",
      lastBuildDate: new Date().toISOString(),
      pubDate: new Date().toISOString(),
    },
    items: [],
    categories: [category],
  };
  
  return { feedId, feed };
}
