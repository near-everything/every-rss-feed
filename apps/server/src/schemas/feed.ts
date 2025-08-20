import { faker } from "@faker-js/faker";
import { z } from "zod";

export const CurrentFeedAuthor = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  avatar: z.string().optional(),
});

export const FeedAuthor = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  link: z.string().optional(),
  avatar: z.string().optional(),
});


export const FeedEnclosure = z.object({
  url: z.string(),
  type: z.string().optional(),
  length: z.number().optional(),
  title: z.string().optional(),
  duration: z.number().optional(),
});

export const FeedCategory = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  scheme: z.string().optional(),
  term: z.string().optional(),
});

export const FeedExtension = z.object({
  name: z.string(),
  objects: z.any(),
});

export const FeedItem = z.object({
  title: z.string(),
  id: z.string().optional(),
  link: z.string(),
  date: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  category: z.array(FeedCategory).optional(),
  guid: z.string().optional(),
  image: z.union([z.string(), FeedEnclosure]).optional(),
  audio: z.union([z.string(), FeedEnclosure]).optional(),
  video: z.union([z.string(), FeedEnclosure]).optional(),
  enclosure: FeedEnclosure.optional(),
  author: z.array(FeedAuthor).optional(),
  contributor: z.array(FeedAuthor).optional(),
  published: z.string().optional(),
  copyright: z.string().optional(),
  extensions: z.array(FeedExtension).optional(),
});

export const CurrentFeedItem = z.object({
  id: z.string(),
  content_html: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  date_modified: z.string().optional(),
  date_published: z.string().optional(),
  author: CurrentFeedAuthor.optional(),
});

export const FeedOptions = z.object({
  id: z.string(),
  title: z.string(),
  updated: z.string().optional(),
  generator: z.string().optional(),
  language: z.string().optional(),
  ttl: z.number().optional(),
  feed: z.string().optional(),
  feedLinks: z.any().optional(),
  hub: z.string().optional(),
  docs: z.string().optional(),
  podcast: z.boolean().optional(),
  category: z.string().optional(),
  author: FeedAuthor.optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
  copyright: z.string(),
});

export const CurrentFeed = z.object({
  version: z.string(),
  title: z.string(),
  home_page_url: z.string().optional(),
  feed_url: z.string().optional(),
  description: z.string().optional(),
  items: z.array(CurrentFeedItem),
});

export const Feed = z.object({
  items: z.array(FeedItem),
  options: FeedOptions,
  categories: z.array(z.string()),
  contributors: z.array(FeedAuthor),
  extensions: z.array(FeedExtension),
});

export type FeedAuthor = z.infer<typeof FeedAuthor>;
export type FeedEnclosure = z.infer<typeof FeedEnclosure>;
export type FeedCategory = z.infer<typeof FeedCategory>;
export type FeedExtension = z.infer<typeof FeedExtension>;
export type FeedItem = z.infer<typeof FeedItem>;
export type FeedOptions = z.infer<typeof FeedOptions>;
export type Feed = z.infer<typeof Feed>;

// Transformation schema to convert CurrentFeed to Feed
export const CurrentFeedToFeed = CurrentFeed.transform((currentFeed): Feed => {
  // Generate categories for the feed using faker
  const categoryNames = [
    faker.commerce.department(), faker.science.chemicalElement().name,
    faker.company.buzzNoun(), faker.hacker.noun(), faker.commerce.productAdjective(),
    faker.word.noun(), faker.commerce.productMaterial(), faker.hacker.abbreviation()
  ];

  const feedCategories = [...new Set(categoryNames)].slice(0, Math.floor(Math.random() * 5) + 3);

  // Generate mock contributors using faker
  const contributors: FeedAuthor[] = Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    link: faker.internet.url(),
    avatar: faker.image.avatar(),
  }));

  // Transform items
  const transformedItems: FeedItem[] = currentFeed.items.map((item, index) => {
    // Generate ID if missing
    const id = item.id || faker.string.uuid();

    // Parse dates with fallbacks
    const parseDate = (dateStr?: string) => {
      if (!dateStr) return faker.date.recent().toISOString();
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? faker.date.recent().toISOString() : parsed.toISOString();
    };

    // Transform author with faker fallbacks
    const author = item.author ? [{
      name: item.author.name || faker.person.fullName(),
      email: faker.internet.email(),
      link: item.author.url || faker.internet.url(),
      avatar: item.author.avatar || faker.image.avatar(),
    }] : [{
      name: faker.person.fullName(),
      email: faker.internet.email(),
      link: faker.internet.url(),
      avatar: faker.image.avatar(),
    }];

    // Assign random categories to each item
    const numCategories = Math.floor(Math.random() * 3) + 1;
    const shuffledCategories = [...feedCategories].sort(() => 0.5 - Math.random());
    const itemCategories = shuffledCategories.slice(0, numCategories).map(name => ({
      name,
      domain: faker.internet.domainName(),
      scheme: faker.internet.url(),
      term: faker.helpers.slugify(name),
    }));

    // Generate media content with faker
    const shouldHaveImage = faker.datatype.boolean({ probability: 0.7 });
    const shouldHaveAudio = faker.datatype.boolean({ probability: 0.3 });
    const shouldHaveVideo = faker.datatype.boolean({ probability: 0.2 });

    const imageEnclosure = shouldHaveImage ? {
      url: faker.image.url({ width: 400, height: 300 }),
      type: "image/jpeg",
      length: faker.number.int({ min: 50000, max: 500000 }),
      title: faker.lorem.words(3),
      duration: undefined,
    } : undefined;

    const audioEnclosure = shouldHaveAudio ? {
      url: `https://example.com/audio/${faker.string.uuid()}.mp3`,
      type: "audio/mpeg",
      length: faker.number.int({ min: 1000000, max: 10000000 }),
      title: faker.music.songName(),
      duration: faker.number.int({ min: 60, max: 3600 }),
    } : undefined;

    const videoEnclosure = shouldHaveVideo ? {
      url: `https://example.com/video/${faker.string.uuid()}.mp4`,
      type: "video/mp4",
      length: faker.number.int({ min: 5000000, max: 50000000 }),
      title: faker.lorem.words(4),
      duration: faker.number.int({ min: 120, max: 7200 }),
    } : undefined;

    return {
      title: item.title || faker.lorem.sentence(),
      id,
      link: item.url || faker.internet.url(),
      date: parseDate(item.date_published),
      description: item.summary || faker.lorem.paragraph(),
      content: item.content_html || faker.lorem.paragraphs(3, '<br/>'),
      category: itemCategories,
      guid: id,
      image: shouldHaveImage ? (Math.random() > 0.5 ? faker.image.url() : imageEnclosure) : undefined,
      audio: shouldHaveAudio ? (Math.random() > 0.5 ? `https://example.com/audio/${faker.string.uuid()}.mp3` : audioEnclosure) : undefined,
      video: shouldHaveVideo ? (Math.random() > 0.5 ? `https://example.com/video/${faker.string.uuid()}.mp4` : videoEnclosure) : undefined,
      enclosure: faker.helpers.maybe(() => ({
        url: faker.internet.url(),
        type: faker.helpers.arrayElement(["application/pdf", "image/jpeg", "audio/mpeg", "video/mp4"]),
        length: faker.number.int({ min: 1000, max: 10000000 }),
        title: faker.lorem.words(2),
        duration: faker.number.int({ min: 30, max: 1800 }),
      }), { probability: 0.3 }),
      author,
      contributor: faker.helpers.maybe(() => [faker.helpers.arrayElement(contributors)], { probability: 0.2 }),
      published: parseDate(item.date_modified),
      copyright: faker.helpers.maybe(() => `© ${faker.date.recent().getFullYear()} ${faker.company.name()}`, { probability: 0.4 }),
      extensions: faker.helpers.maybe(() => [{
        name: faker.hacker.noun(),
        objects: { [faker.hacker.abbreviation()]: faker.lorem.words() },
      }], { probability: 0.1 }),
    };
  });

  // Transform feed options with faker enhancements
  const options: FeedOptions = {
    id: faker.string.uuid(),
    title: currentFeed.title,
    updated: new Date().toISOString(),
    generator: "Curate News Feed",
    language: faker.helpers.arrayElement(["en", "es", "fr", "de", "it", "pt"]),
    ttl: faker.number.int({ min: 30, max: 1440 }),
    feed: currentFeed.feed_url,
    feedLinks: undefined,
    hub: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }),
    docs: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.2 }),
    podcast: faker.datatype.boolean({ probability: 0.3 }),
    category: faker.helpers.maybe(() => faker.helpers.arrayElement(feedCategories), { probability: 0.5 }),
    author: faker.helpers.maybe(() => faker.helpers.arrayElement(contributors), { probability: 0.6 }),
    link: currentFeed.home_page_url || faker.internet.url(),
    description: currentFeed.description || faker.lorem.paragraph(),
    image: faker.image.url({ width: 600, height: 400 }),
    favicon: faker.helpers.maybe(() => `${faker.internet.url()}/favicon.ico`, { probability: 0.7 }),
    copyright: `© ${new Date().getFullYear()} ${currentFeed.title}`,
  };

  return {
    items: transformedItems,
    options,
    categories: feedCategories,
    contributors,
    extensions: faker.helpers.maybe(() => [{
      name: faker.hacker.noun(),
      objects: {
        [faker.hacker.abbreviation()]: faker.lorem.sentence(),
        version: faker.system.semver(),
      },
    }], { probability: 0.2 }) || [],
  };
});
