import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

if(!process.env.ELASTICSEARCH_NODE || !process.env.ELASTICSEARCH_USERNAME || !process.env.ELASTICSEARCH_PASSWORD) {
  throw new Error('Elasticsearch configuration is not set');
}

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },
});

interface ElasticActivity {
  id: number;
  text: string;
  rules: string;
  answers: string[];
}

interface ElasticActivitySource {
  activityIndex: number;
  pageNumber: number;
  activities: ElasticActivity[];
}

interface ElasticSearchHit {
  _source: ElasticActivitySource;
}

export interface ProcessedActivity {
  id: number;
  generalId: number;
  text: string;
  pageNumber: number;
  activityIndex: number;
}

export async function getActivitiesFromElastic(
  bookId: number,
  activityIndex: number
): Promise<ProcessedActivity[]> {
  try {
    const response = await client.search({
      index: 'etkinlikler2',
      body: {
        _source: true,
        size: 10000, // Elasticsearch 7'de max result için
        query: {
          bool: {
            must: [
              { term: { bookId } },
              { term: { activityIndex } },
            ],
          },
        },
      },
    });

    const hits = response.body.hits.hits as ElasticSearchHit[];

    if (hits.length === 0) {
      throw new Error(`No activities found for bookId: ${bookId}, activityIndex: ${activityIndex}`);
    }

    // Collect all pages with activities
    const pages: ElasticActivitySource[] = hits.map(hit => hit._source);

    // Sort by pageNumber
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    // Flatten activities and assign generalId
    const processedActivities: ProcessedActivity[] = [];
    let generalId = 1;

    for (const page of pages) {
      for (const activity of page.activities) {
        processedActivities.push({
          id: activity.id,
          generalId: generalId++,
          text: activity.text,
          pageNumber: page.pageNumber,
          activityIndex: page.activityIndex,
        });
      }
    }

    return processedActivities;
  } catch (error) {
    console.error('Elasticsearch error:', error);
    throw new Error('Failed to fetch activities from Elasticsearch');
  }
}
