# Find Kazanim LLM

Google GenAI kullanarak soruların ünite, konu ve kazanımlarını otomatik olarak eşleştiren Express.js API projesi.

## Kurulum

```bash
pnpm install
```

## Konfigürasyon

`.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değerleri doldurun:

```bash
cp .env.example .env
```

### Environment Variables

- `GEMINI_API_KEY`: Google GenAI API anahtarınız
- `PORT`: Server portu (varsayılan: 3000)
- `DB_SERVER`: MSSQL server adresi
- `DB_DATABASE`: Veritabanı adı
- `DB_USER`: Kullanıcı adı
- `DB_PASSWORD`: Şifre
- `DB_PORT`: MSSQL portu (varsayılan: 1433)

## Kullanım

### Development Mode

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm start
```

## API Endpoints

### POST /api/match-kazanim

Soruları kazanımlarla eşleştirir (manuel soru listesi ile).

**Request Body:**

```json
{
  "dersId": 31,
  "questions": [
    {
      "id": 1,
      "text": "Aşağıdaki cümlelerin hangisinde noktalama işareti yanlış kullanılmıştır?"
    },
    {
      "id": 2,
      "text": "Metinde hangi söz sanatı kullanılmıştır?"
    }
  ]
}
```

**Response:**

```json
[
  {
    "id": 1,
    "uniteId": 86,
    "konuId": 1641,
    "kazanimId": 3636
  },
  {
    "id": 2,
    "uniteId": 86,
    "konuId": 4218,
    "kazanimId": 3643
  }
]
```

### POST /api/match-kazanim-from-xml

XML dosyasından soruları okuyarak kazanımlarla eşleştirir. Opsiyonel olarak sonuçları veritabanına kaydeder.

**Request Body (Sadece Eşleştirme):**

```json
{
  "dersId": 31,
  "testXmlPath": "c:\\path\\to\\test.xml",
  "testSira": 0,
  "save": false
}
```

**Request Body (Eşleştirme + Veritabanına Kaydetme):**

```json
{
  "dersId": 31,
  "testXmlPath": "c:\\path\\to\\test.xml",
  "testSira": 0,
  "save": true,
  "kitapId": 3943,
  "testId": 143584
}
```

veya HTTP URL ile:

```json
{
  "dersId": 31,
  "testXmlPath": "https://example.com/test.xml",
  "testSira": 0,
  "save": true,
  "kitapId": 3943,
  "testId": 143584
}
```

**Parametreler:**

- `dersId`: Ders ID (MSSQL'deki DersId)
- `testXmlPath`: XML dosya yolu (local path veya HTTP/HTTPS URL)
- `testSira`: XML içindeki test ID'si (hangi testi parse edeceğini belirtir)
- `save`: (Opsiyonel) `true` ise sonuçları veritabanına kaydeder
- `kitapId`: (save=true ise zorunlu) Kitap ID
- `testId`: (save=true ise zorunlu) Test ID

**XML Formatı:**

```xml
<testler SECENEK="false" SECENEKYARICAP="8" TEKRARAC="false">
  <test ADI="Türkçe" ID="0" BaslangicSayfasi="5" BitisSayfasi="7">
    <item>
      <soruNo>1</soruNo>
      <testId>0</testId>
      <question_content>Soru metni burada...</question_content>
      <!-- diğer alanlar -->
    </item>
  </test>
</testler>
```

**Response (save=false):**

```json
[
  {
    "id": 1,
    "uniteId": 86,
    "konuId": 1641,
    "kazanimId": 3636
  },
  {
    "id": 2,
    "uniteId": 86,
    "konuId": 4218,
    "kazanimId": 3643
  }
]
```

**Response (save=true):**

```json
{
  "matchResults": [
    {
      "id": 1,
      "uniteId": 86,
      "konuId": 1641,
      "kazanimId": 3636
    },
    {
      "id": 2,
      "uniteId": 86,
      "konuId": 4218,
      "kazanimId": 3643
    }
  ],
  "saveResults": [
    {
      "soruId": 1,
      "saved": true,
      "skipped": false
    },
    {
      "soruId": 2,
      "saved": false,
      "skipped": true,
      "reason": "Record already exists in database"
    }
  ],
  "summary": {
    "total": 2,
    "saved": 1,
    "skipped": 1,
    "errors": 0
  }
}
```

**Veritabanı Kaydetme Mantığı:**

- `save=true` olduğunda, her soru için `S_CaprazGorevHistoryKazanim` tablosuna kayıt yapılır
- Kaydetmeden önce `KitapId`, `TestId` ve `SoruId` ile kontrol edilir
- Eğer kayıt zaten varsa, o soru atlanır (`skipped: true`)
- Yeni kayıtlar için:
  - `UniteId`, `KonuId`, `KazanimId`: AI'dan gelen değerler
  - `KitapId`, `TestId`: Request body'den
  - `SoruId`: Soru ID'si
  - `ZorlukDuzeyi`: 3 (default)
  - `CreatedBy`: 109
  - `CreatedAt`, `CRT_TST`: Şu anki zaman

### POST /api/match-activities

Elasticsearch'ten etkinlikleri çekerek kazanımlarla eşleştirir ve veritabanını günceller. **Toplu işlem destekler.**

**Request Body (Tek Etkinlik):**

```json
{
  "bookId": 65366,
  "activities": [
    {
      "dersId": 31,
      "activityIndex": 1,
      "etkinlikId": 7805
    }
  ]
}
```

**Request Body (Toplu İşlem - Aynı Ders):**

```json
{
  "bookId": 65366,
  "activities": [
    {
      "dersId": 31,
      "activityIndex": 1,
      "etkinlikId": 7805
    },
    {
      "dersId": 31,
      "activityIndex": 2,
      "etkinlikId": 7806
    },
    {
      "dersId": 31,
      "activityIndex": 3,
      "etkinlikId": 7807
    }
  ]
}
```

**Request Body (Toplu İşlem - Farklı Dersler):**

```json
{
  "bookId": 65366,
  "activities": [
    {
      "dersId": 31,
      "activityIndex": 1,
      "etkinlikId": 7805
    },
    {
      "dersId": 32,
      "activityIndex": 2,
      "etkinlikId": 7806
    }
  ]
}
```

**Parametreler:**

- `bookId`: Kitap ID (Elasticsearch'te arama için)
- `activities`: Etkinlik listesi (array)
  - `dersId`: Ders ID (kazanımları çekmek için, her etkinlik için ayrı olabilir)
  - `activityIndex`: Etkinlik indeksi (Elasticsearch'te filtreleme için)
  - `etkinlikId`: Etkinlik ID (MSSQL'de update için)

**İşlem Akışı:**

1. Her etkinlik için sırayla:
   - Elasticsearch'ten etkinlikler çekilir (bookId + activityIndex)
   - Sayfalar pageNumber'a göre sıralanır
   - Etkinlikler flatten edilir ve generalId atanır (1'den başlayarak)
   - AI ile kazanım eşleştirmesi yapılır
   - `S_EtkinliklerSoru` tablosunda update yapılır (UniteId, KonuId, KazanimId)
2. Tüm sonuçlar toplanır ve genel özet oluşturulur

**Response:**

```json
{
  "results": [
    {
      "dersId": 31,
      "activityIndex": 1,
      "etkinlikId": 7805,
      "matchResults": [
        {
          "id": 1,
          "uniteId": 86,
          "konuId": 1641,
          "kazanimId": 3636
        }
      ],
      "updateResults": [
        {
          "generalId": 1,
          "updated": true
        }
      ],
      "summary": {
        "total": 1,
        "updated": 1,
        "errors": 0
      }
    },
    {
      "dersId": 31,
      "activityIndex": 2,
      "etkinlikId": 7806,
      "matchResults": [...],
      "updateResults": [...],
      "summary": {
        "total": 2,
        "updated": 2,
        "errors": 0
      }
    }
  ],
  "overallSummary": {
    "totalActivities": 2,
    "successfulActivities": 2,
    "failedActivities": 0,
    "totalUpdated": 3,
    "totalErrors": 0
  }
}
```

**Veritabanı Update:**

- Tablo: `S_EtkinliklerSoru`
- Update edilen alanlar: `UniteId`, `KonuId`, `KazanimId`
- Where koşulu: `EtkinlikId = @etkinlikId AND GenelSira = @genelSira`
- Diğer alanlar (UpdatedAt, UpdatedBy, vb.) değiştirilmez

### GET /health

Server durumunu kontrol eder.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-06T10:30:00.000Z"
}
```

## Veritabanı Yapısı

### MSSQL Tabloları

- `S_TestKazanimlar`: Kazanımlar
- `S_TestKonular`: Konular
- `S_TestUniteler`: Üniteler
- `S_CaprazGorevHistoryKazanim`: Soru-kazanım eşleştirme geçmişi
- `S_EtkinliklerSoru`: Etkinlik soruları ve kazanım bilgileri

### Elasticsearch İndeksleri

- `etkinlikler2`: Kitap etkinlikleri

## Teknolojiler

- **Express.js**: Web framework
- **TypeScript**: Type-safe JavaScript
- **Google GenAI**: AI model (Gemini 2.0 Flash)
- **MSSQL**: Veritabanı
- **Elasticsearch 7**: Etkinlik verileri
- **fast-xml-parser**: XML parsing
- **axios**: HTTP client
- **tsx**: TypeScript execution engine

## Nasıl Çalışır?

### Manuel Soru Listesi (`/api/match-kazanim`)

1. Client, `dersId` ve soru listesi göndererek endpoint'e istek atar
2. Backend, MSSQL'den ilgili ders için tüm kazanımları çeker
3. Kazanımlar ve sorular, optimize edilmiş bir prompt ile Google GenAI'ya gönderilir
4. AI, her soru için en uygun ünite, konu ve kazanım eşleştirmesini yapar
5. Sonuç JSON formatında client'a döndürülür

### XML Dosyasından (`/api/match-kazanim-from-xml`)

1. Client, `dersId`, `testXmlPath` ve `testSira` göndererek endpoint'e istek atar
2. Backend, XML dosyasını okur (local path veya HTTP URL)
3. XML parse edilir ve belirtilen `testSira` ID'sine sahip test bulunur
4. Test içindeki tüm sorular (`question_content`) çıkarılır
5. Sorular, standart eşleştirme akışına gönderilir (yukarıdaki adımlar 2-5)

## Test Etme

```bash
# Manuel soru listesi ile test
.\test-api.ps1

# XML dosyasından test (sadece eşleştirme)
.\test-xml-api.ps1

# XML dosyasından test (eşleştirme + veritabanına kaydetme)
.\test-xml-api-with-save.ps1

# Etkinlik eşleştirme ve güncelleme
.\test-activity-api.ps1
```

## Lisans

ISC
