import { GoogleGenAI, Type } from '@google/genai';
import { getDisKazanimChunks } from './database.js';

interface SearchQuery {
  id: number | string;
  text: string;
}

interface KazanimMatch {
  uniteId: number;
  konuId: number;
  kazanimId: number;
  kazanimText: string;
  confidenceScore: number;
}

interface SearchResult {
  queryId: number | string;
  queryText: string;
  matches: KazanimMatch[];
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

function buildBatchSearchPrompt(chunks: string, queries: SearchQuery[], topK: number): string {
  const queriesText = queries
    .map(q => `[${q.id}] ${q.text}`)
    .join('\n');

  return `Sen deneyimli bir öğretmensin ve eğitim kazanımları konusunda uzmansın.

Amacın: Verilen arama metinlerine göre, aşağıdaki kazanım listesinden her arama için en uygun ${topK} kazanımı bulmak ve her biri için doğruluk oranı (confidence score) vermek.

ÖNEMLI KURALLAR:
1. Arama metni ile kazanımlar arasında semantik benzerlik ara
2. Tam kelime eşleşmesi gerekmez, anlam benzerliği önemli
3. Her arama için en uygun ${topK} kazanımı seç ve doğruluk oranına göre sırala (en yüksek önce)
4. Confidence score 0-100 arası bir sayı olmalı (100 = mükemmel eşleşme, 0 = hiç eşleşmiyor)
5. ID'leri köşeli parantez içinden tam olarak çıkar: [84], [4195], [3618] gibi
6. Hiyerarşi: Ünite > Konu > Kazanım şeklinde birbiriyle bağlantılı

KAZANIM LİSTESİ (DİS KAZANIMLAR):
${chunks}

ARAMA METİNLERİ:
${queriesText}

ÇIKTI FORMATI:
Sadece JSON object döndür, başka hiçbir açıklama ekleme. Her arama ID'si için ayrı bir array oluştur:
{
  "queryId": [
    {
      "uniteId": unite_id_sayı,
      "konuId": konu_id_sayı,
      "kazanimId": kazanim_id_sayı,
      "kazanimText": "Kazanım tam metni",
      "confidenceScore": doğruluk_oranı_0_100
    }
  ]
}

Her query için doğruluk oranına göre azalan sırada döndür (en yüksek confidence önce).`;
}

export async function searchDisKazanimlar(
  dersId: number,
  queries: SearchQuery[],
  topK: number = 5
): Promise<SearchResult[]> {
  // Fetch chunks from database
  const chunks = await getDisKazanimChunks(dersId);
  
  if (chunks.length === 0) {
    throw new Error(`No dis kazanim found for dersId: ${dersId}`);
  }

  // Build context from chunks
  const chunksText = chunks
    .map(c => c.ChunkText)
    .join('\n');

  console.log(`Searching ${queries.length} queries in batch mode (Dis Kazanimlar)`);

  // Build prompt for all queries at once
  const prompt = buildBatchSearchPrompt(chunksText, queries, topK);

  // Create dynamic schema based on query IDs
  const schemaProperties: Record<string, any> = {};
  const requiredFields: string[] = [];

  for (const query of queries) {
    const queryIdStr = String(query.id);
    schemaProperties[queryIdStr] = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          uniteId: {
            type: Type.INTEGER,
            description: 'Unite ID from the chunk',
          },
          konuId: {
            type: Type.INTEGER,
            description: 'Konu ID from the chunk',
          },
          kazanimId: {
            type: Type.INTEGER,
            description: 'Kazanim ID from the chunk',
          },
          kazanimText: {
            type: Type.STRING,
            description: 'Full text of the kazanim',
          },
          confidenceScore: {
            type: Type.NUMBER,
            description: 'Confidence score 0-100',
          },
        },
        required: ['uniteId', 'konuId', 'kazanimId', 'kazanimText', 'confidenceScore'],
      },
    };
    requiredFields.push(queryIdStr);
  }

  try {
    // Call Google GenAI with all queries at once
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: requiredFields,
        },
      },
    });

    const resultText = response.text;
    
    try {
      const batchResults: Record<string, KazanimMatch[]> = JSON.parse(resultText || '{}');
      
      // Convert batch results to individual results
      const results: SearchResult[] = [];
      
      for (const query of queries) {
        const queryIdStr = String(query.id);
        const matches = batchResults[queryIdStr] || [];
        
        console.log(`Found ${matches.length} matches for query ${query.id}: "${query.text}"`);
        
        results.push({
          queryId: query.id,
          queryText: query.text,
          matches,
        });
      }
      
      return results;
    } catch (error) {
      console.error('Failed to parse AI batch response:', resultText);
      
      // Return empty results for all queries
      return queries.map(query => ({
        queryId: query.id,
        queryText: query.text,
        matches: [],
      }));
    }
  } catch (error) {
    console.error('Error in batch search:', error);
    
    // Return empty results for all queries
    return queries.map(query => ({
      queryId: query.id,
      queryText: query.text,
      matches: [],
    }));
  }
}
