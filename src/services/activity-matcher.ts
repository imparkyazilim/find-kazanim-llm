import { GoogleGenAI, Type } from '@google/genai';
import { getKazanimChunks } from './database.js';
import { ProcessedActivity } from './elasticsearch.js';

interface MatchResult {
  id: number;
  uniteId: number;
  konuId: number;
  kazanimId: number;
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

function buildActivityPrompt(chunks: string, activities: ProcessedActivity[]): string {
  const activitiesText = activities
    .map(a => `[${a.generalId}] ${a.text}`)
    .join('\n');

  return `Sen deneyimli bir Türkçe öğretmenisin ve eğitim kazanımları konusunda uzmansın.

Amacın: Verilen etkinlik metinlerine göre, aşağıdaki kazanım listesinden her etkinlik için en uygun Ünite, Konu ve Kazanım eşleştirmesi yapmak.

ÖNEMLI KURALLAR:
1. Sıralama: Önce Ünite bulunur → Sonra Konu bulunur → Son olarak Kazanım bulunur
2. Hiyerarşi: Ünite > Konu > Kazanım şeklinde birbiriyle bağlantılı
   - Her ünite altında konular var
   - Her konu içerisinde kazanımlar var
3. Her etkinliği dikkatlice analiz et ve en uygun kazanımı bul
4. Eğer bir etkinlik birden fazla kazanıma uyuyorsa, en uygun olanı seç
5. ID'leri köşeli parantez içinden tam olarak çıkar: [84], [4195], [3618] gibi

KAZANIM LİSTESİ:
${chunks}

ETKİNLİKLER:
${activitiesText}

ÇIKTI FORMATI:
Sadece JSON array döndür, başka hiçbir açıklama ekleme. Her etkinlik için şu formatta bir obje oluştur:
{
  "id": etkinlik_general_id,
  "uniteId": unite_id_sayı,
  "konuId": konu_id_sayı,
  "kazanimId": kazanim_id_sayı
}`;
}

export async function matchActivitiesToKazanim(
  dersId: number,
  activities: ProcessedActivity[]
): Promise<MatchResult[]> {
  // Fetch chunks from database
  const chunks = await getKazanimChunks(dersId);
  
  if (chunks.length === 0) {
    throw new Error(`No kazanim found for dersId: ${dersId}`);
  }

  // Build context from chunks
  const chunksText = chunks
    .map(c => c.ChunkText)
    .join('\n');

  // Build prompt
  const prompt = buildActivityPrompt(chunksText, activities);

  // Call Google GenAI
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.INTEGER,
              description: 'Activity General ID',
            },
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
          },
          required: ['id', 'uniteId', 'konuId', 'kazanimId'],
        },
      },
    },
  });

  const resultText = response.text;
  
  try {
    const results: MatchResult[] = JSON.parse(resultText || '');
    return results;
  } catch (error) {
    console.error('Failed to parse AI response:', resultText);
    throw new Error('Invalid response from AI model');
  }
}
