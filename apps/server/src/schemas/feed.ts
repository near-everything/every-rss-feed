import { z } from "zod";

export const FeedAuthor = z.object({
  name: z.string().optional(),
  url: z.string().optional(), // JSON Feed uses 'url' not 'link'
  // email: z.string().optional(),
  // link: z.string().optional(),
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
  // title: z.string(),
  // id: z.string().optional(),
  // link: z.string(),
  // date: z.coerce.date(), // Handle string to Date conversion
  // description: z.string().optional(),
  // content: z.string().optional(),
  // category: z.array(FeedCategory).optional(),
  // guid: z.string().optional(),
  // image: z.union([z.string(), FeedEnclosure]).optional(),
  // audio: z.union([z.string(), FeedEnclosure]).optional(),
  // video: z.union([z.string(), FeedEnclosure]).optional(),
  // enclosure: FeedEnclosure.optional(),
  // author: z.array(FeedAuthor).optional(),
  // contributor: z.array(FeedAuthor).optional(),
  // published: z.coerce.date().optional(), // Handle string to Date conversion
  // copyright: z.string().optional(),
  // extensions: z.array(FeedExtension).optional(),

  id: z.string(),
  content_html: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  date_modified: z.string().optional(), // Keep as string since JSON Feed uses ISO strings
  date_published: z.string().optional(),
  author: FeedAuthor.optional(),
});



export const FeedOptions = z.object({
  id: z.string(),
  title: z.string(),
  updated: z.coerce.date().optional(),
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


export const Feed = z.object({
  version: z.string(),
  title: z.string(),
  home_page_url: z.string().optional(),
  feed_url: z.string().optional(),
  description: z.string().optional(), // TODO: INCONSISTENCY

  items: z.array(FeedItem), // this is only one that is correct
//   options: FeedOptions,
//   categories: z.array(z.string()),
//   contributors: z.array(FeedAuthor),
//   extensions: z.array(FeedExtension),
});

export type FeedAuthor = z.infer<typeof FeedAuthor>;
export type FeedEnclosure = z.infer<typeof FeedEnclosure>;
export type FeedCategory = z.infer<typeof FeedCategory>;
export type FeedExtension = z.infer<typeof FeedExtension>;
export type FeedItem = z.infer<typeof FeedItem>;
export type FeedOptions = z.infer<typeof FeedOptions>;
export type Feed = z.infer<typeof Feed>;
