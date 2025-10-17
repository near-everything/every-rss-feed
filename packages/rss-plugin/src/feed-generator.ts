import { Feed as FeedGenerator } from "feed";
import { Feed, FeedItem, FeedAuthor, FeedCategory } from "./schemas/feed";

export function generateRssXml(feedData: Feed, baseUrl: string = "http://localhost:1337"): string {
  const { options, items } = feedData;

  const feed = new FeedGenerator({
    title: options.title,
    description: options.description || "",
    id: `${baseUrl}/feeds/${options.id}`,
    link: options.link || `${baseUrl}/feeds/${options.id}`,
    language: options.language || "en",
    image: options.image,
    favicon: options.favicon,
    copyright: options.copyright,
    updated: options.updated ? new Date(options.updated) : new Date(),
    generator: options.generator || "Every RSS Feed Service",
    feedLinks: {
      rss: `${baseUrl}/feeds/${options.id}/rss.xml`,
      atom: `${baseUrl}/feeds/${options.id}/atom.xml`,
    },
    author: options.author ? {
      name: options.author.name || "",
      email: options.author.email || "",
      link: options.author.link || "",
    } : undefined,
  });

  // Add items to feed
  items.forEach((item) => {
    const categories = item.category?.map((cat) => ({
      name: cat.name || cat.term || "",
      domain: cat.domain,
      scheme: cat.scheme,
    })) || [];

    const authors = item.author?.map((author) => ({
      name: author.name || "",
      email: author.email || "",
      link: author.link || "",
    })) || [];

    const contributors = item.contributor?.map((contributor) => ({
      name: contributor.name || "",
      email: contributor.email || "",
      link: contributor.link || "",
    })) || [];

    feed.addItem({
      title: item.title,
      id: item.guid || item.id || item.link,
      link: item.link,
      description: item.description || "",
      content: item.content || item.description || "",
      author: authors,
      contributor: contributors,
      date: new Date(item.published || item.date),
      category: categories,
      image: typeof item.image === "string" ? item.image : item.image?.url,
      audio: typeof item.audio === "string" ? item.audio : item.audio?.url,
      video: typeof item.video === "string" ? item.video : item.video?.url,
      enclosure: item.enclosure ? {
        url: item.enclosure.url,
        type: item.enclosure.type,
        length: item.enclosure.length,
        title: item.enclosure.title,
        duration: item.enclosure.duration,
      } : undefined,
      published: item.published ? new Date(item.published) : undefined,
      copyright: item.copyright,
    });
  });

  return feed.rss2();
}

export function generateAtomXml(feedData: Feed, baseUrl: string = "http://localhost:1337"): string {
  const { options, items } = feedData;

  const feed = new FeedGenerator({
    title: options.title,
    description: options.description || "",
    id: `${baseUrl}/feeds/${options.id}`,
    link: options.link || `${baseUrl}/feeds/${options.id}`,
    language: options.language || "en",
    image: options.image,
    favicon: options.favicon,
    copyright: options.copyright,
    updated: options.updated ? new Date(options.updated) : new Date(),
    generator: options.generator || "Every RSS Feed Service",
    feedLinks: {
      rss: `${baseUrl}/feeds/${options.id}/rss.xml`,
      atom: `${baseUrl}/feeds/${options.id}/atom.xml`,
    },
    author: options.author ? {
      name: options.author.name || "",
      email: options.author.email || "",
      link: options.author.link || "",
    } : undefined,
  });

  // Add items to feed (same logic as RSS)
  items.forEach((item) => {
    const categories = item.category?.map((cat) => ({
      name: cat.name || cat.term || "",
      domain: cat.domain,
      scheme: cat.scheme,
    })) || [];

    const authors = item.author?.map((author) => ({
      name: author.name || "",
      email: author.email || "",
      link: author.link || "",
    })) || [];

    const contributors = item.contributor?.map((contributor) => ({
      name: contributor.name || "",
      email: contributor.email || "",
      link: contributor.link || "",
    })) || [];

    feed.addItem({
      title: item.title,
      id: item.guid || item.id || item.link,
      link: item.link,
      description: item.description || "",
      content: item.content || item.description || "",
      author: authors,
      contributor: contributors,
      date: new Date(item.published || item.date),
      category: categories,
      image: typeof item.image === "string" ? item.image : item.image?.url,
      audio: typeof item.audio === "string" ? item.audio : item.audio?.url,
      video: typeof item.video === "string" ? item.video : item.video?.url,
      enclosure: item.enclosure ? {
        url: item.enclosure.url,
        type: item.enclosure.type,
        length: item.enclosure.length,
        title: item.enclosure.title,
        duration: item.enclosure.duration,
      } : undefined,
      published: item.published ? new Date(item.published) : undefined,
      copyright: item.copyright,
    });
  });

  return feed.atom1();
}
