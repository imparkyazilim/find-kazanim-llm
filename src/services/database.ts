import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

if(!process.env.DB_SERVER || !process.env.DB_DATABASE || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error('Database configuration is not set');
}

const config: sql.config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  requestTimeout: 90000,
};

export interface KazanimChunk {
  KazanimId: number;
  ChunkText: string;
  UniteId: number;
  KonuId: number;
}

export interface MatchResult {
  id: number | string;
  uniteId: number;
  konuId: number;
  kazanimId: number;
}

export interface SaveResult {
  soruId: number | string;
  saved: boolean;
  skipped: boolean;
  reason?: string;
}

export interface ActivityUpdateResult {
  generalId: number;
  updated: boolean;
  reason?: string;
}

export async function getKazanimChunks(dersId: number): Promise<KazanimChunk[]> {
  try {
    const pool = await sql.connect(config);
    
    const result = await pool.request()
      .input('dersId', sql.Int, dersId)
      .query(`
        SELECT 
          kz.Id AS KazanimId,
          'Ünite [' + CAST(u.Id AS VARCHAR(10)) + ']: ' + u.Adi + 
          ' | Konu [' + CAST(k.Id AS VARCHAR(10)) + ']: ' + k.Adi + 
          ' | Kazanım [' + CAST(kz.Id AS VARCHAR(10)) + ']: ' + kz.Adi + 
          ISNULL(' | Açıklama: ' + kz.Aciklama, '') AS ChunkText,
          u.Id AS UniteId,
          k.Id AS KonuId
        FROM [dbo].[S_TestKazanimlar] kz
        INNER JOIN [dbo].[S_TestKonular] k ON kz.KonuId = k.Id
        INNER JOIN [dbo].[S_TestUniteler] u ON k.UniteId = u.Id
        WHERE u.Silindi = 0 AND DersId = @dersId
        ORDER BY u.Sira, k.Id, kz.Sira
      `);

    await pool.close();
    
    return result.recordset as KazanimChunk[];
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch kazanim chunks from database');
  }
}

async function checkExistingRecord(
  kitapId: number,
  testId: number,
  soruId: number
): Promise<boolean> {
  try {
    const pool = await sql.connect(config);
    
    const result = await pool.request()
      .input('kitapId', sql.Int, kitapId)
      .input('testId', sql.Int, testId)
      .input('soruId', sql.Int, soruId)
      .query(`
        SELECT COUNT(*) as RecordCount
        FROM [dbo].[S_CaprazGorevHistoryKazanim]
        WHERE KitapId = @kitapId 
          AND TestId = @testId 
          AND SoruId = @soruId
      `);

    await pool.close();
    
    const count = result.recordset[0].RecordCount;
    return count > 0;
  } catch (error) {
    console.error('Database error in checkExistingRecord:', error);
    throw new Error('Failed to check existing record');
  }
}

async function insertKazanimRecord(
  uniteId: number,
  konuId: number,
  kazanimId: number,
  kitapId: number,
  testId: number,
  soruId: number
): Promise<void> {
  try {
    const pool = await sql.connect(config);
    const now = new Date();
    
    await pool.request()
      .input('uniteId', sql.Int, uniteId)
      .input('konuId', sql.Int, konuId)
      .input('kazanimId', sql.Int, kazanimId)
      .input('kitapId', sql.Int, kitapId)
      .input('testId', sql.Int, testId)
      .input('soruId', sql.Int, soruId)
      .input('zorlukDuzeyi', sql.Int, 3)
      .input('OgretmenId', sql.Int, 109)
      .input('createdAt', sql.DateTime, now)
      .input('crtTst', sql.DateTime, now)
      .input('createdBy', sql.Int, 109)
      .query(`
        INSERT INTO [dbo].[S_CaprazGorevHistoryKazanim]
        (UniteId, KonuId, KazanimId, KitapId, TestId, SoruId, ZorlukDuzeyi, OgretmenId, CRT_TST, CreatedAt, CreatedBy)
        VALUES
        (@uniteId, @konuId, @kazanimId, @kitapId, @testId, @soruId, @zorlukDuzeyi, @ogretmenId, @crtTst, @createdAt, @createdBy)
      `);

    await pool.close();
  } catch (error) {
    console.error('Database error in insertKazanimRecord:', error);
    throw new Error('Failed to insert kazanim record');
  }
}

export async function saveMatchResults(
  results: MatchResult[],
  kitapId: number,
  testId: number
): Promise<SaveResult[]> {
  const saveResults: SaveResult[] = [];

  for (const result of results) {
    try {
      const soruId = typeof result.id === 'string' ? parseInt(result.id) : result.id;

      // Check if record already exists
      const exists = await checkExistingRecord(kitapId, testId, soruId);

      if (exists) {
        console.log(`Skipping SoruId ${soruId}: Record already exists (KitapId: ${kitapId}, TestId: ${testId})`);
        saveResults.push({
          soruId: result.id,
          saved: false,
          skipped: true,
          reason: 'Record already exists in database',
        });
        continue;
      }

      // Insert new record
      await insertKazanimRecord(
        result.uniteId,
        result.konuId,
        result.kazanimId,
        kitapId,
        testId,
        soruId
      );

      console.log(`Saved SoruId ${soruId}: UniteId=${result.uniteId}, KonuId=${result.konuId}, KazanimId=${result.kazanimId}`);
      saveResults.push({
        soruId: result.id,
        saved: true,
        skipped: false,
      });

    } catch (error) {
      console.error(`Error saving SoruId ${result.id}:`, error);
      saveResults.push({
        soruId: result.id,
        saved: false,
        skipped: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return saveResults;
}

export async function updateActivityKazanim(
  etkinlikId: number,
  genelSira: number,
  uniteId: number,
  konuId: number,
  kazanimId: number
): Promise<void> {
  try {
    const pool = await sql.connect(config);
    
    await pool.request()
      .input('etkinlikId', sql.Int, etkinlikId)
      .input('genelSira', sql.Int, genelSira)
      .input('uniteId', sql.Int, uniteId)
      .input('konuId', sql.Int, konuId)
      .input('kazanimId', sql.Int, kazanimId)
      .query(`
        UPDATE [dbo].[S_EtkinliklerSoru]
        SET UniteId = @uniteId,
            KonuId = @konuId,
            KazanimId = @kazanimId
        WHERE EtkinlikId = @etkinlikId 
          AND GenelSira = @genelSira
      `);

    await pool.close();
  } catch (error) {
    console.error('Database error in updateActivityKazanim:', error);
    throw new Error('Failed to update activity kazanim');
  }
}

export async function updateActivityResults(
  results: MatchResult[],
  etkinlikId: number
): Promise<ActivityUpdateResult[]> {
  const updateResults: ActivityUpdateResult[] = [];

  for (const result of results) {
    try {
      const genelSira = typeof result.id === 'string' ? parseInt(result.id) : result.id;

      await updateActivityKazanim(
        etkinlikId,
        genelSira,
        result.uniteId,
        result.konuId,
        result.kazanimId
      );

      console.log(`Updated GenelSira ${genelSira}: UniteId=${result.uniteId}, KonuId=${result.konuId}, KazanimId=${result.kazanimId}`);
      updateResults.push({
        generalId: genelSira,
        updated: true,
      });

    } catch (error) {
      console.error(`Error updating GenelSira ${result.id}:`, error);
      updateResults.push({
        generalId: typeof result.id === 'string' ? parseInt(result.id) : result.id,
        updated: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return updateResults;
}
