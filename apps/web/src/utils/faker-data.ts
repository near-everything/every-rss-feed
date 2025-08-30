import { faker } from '@faker-js/faker';
import type { Feed, FeedItem } from '../../../server/src/schemas/feed';

export function generateFakeFeedItem(): Omit<FeedItem, 'id'> {
  return {
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    link: faker.internet.url(),
    date: faker.date.recent({ days: 30 }).toISOString(),
    description: faker.lorem.paragraphs(2, '\n\n'),
    content: faker.lorem.paragraphs(4, '\n\n'),
    category: [
      {
        name: faker.helpers.arrayElement(['Technology', 'Science', 'Business', 'Health', 'Sports', 'Entertainment']),
        domain: faker.internet.domainName(),
      }
    ],
    guid: faker.string.uuid(),
    published: faker.date.recent({ days: 30 }).toISOString(),
    author: [
      {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        link: faker.internet.url(),
      }
    ],
  };
}

export function generateFakeFeed(): Feed {
  const feedId = faker.string.uuid();
  const itemCount = faker.number.int({ min: 3, max: 10 });
  
  const items: FeedItem[] = Array.from({ length: itemCount }, () => ({
    ...generateFakeFeedItem(),
    id: faker.string.uuid(),
  }));

  return {
    items,
    options: {
      id: feedId,
      title: faker.company.name() + ' ' + faker.helpers.arrayElement(['News', 'Blog', 'Updates', 'Feed']),
      updated: faker.date.recent({ days: 7 }).toISOString(),
      generator: 'Faker RSS Generator',
      language: 'en-US',
      ttl: faker.number.int({ min: 60, max: 1440 }),
      link: faker.internet.url(),
      description: faker.lorem.sentences(2),
      image: faker.image.url({ width: 400, height: 200 }),
      copyright: `© ${new Date().getFullYear()} ${faker.company.name()}`,
    },
    categories: faker.helpers.arrayElements(['Technology', 'Science', 'Business', 'Health', 'Sports'], { min: 1, max: 3 }),
    contributors: [
      {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        link: faker.internet.url(),
      }
    ],
    extensions: [],
  };
}
