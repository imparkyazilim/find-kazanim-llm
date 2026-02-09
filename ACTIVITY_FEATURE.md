# Activity Matching Feature Documentation

## Genel Bakış

`/api/match-activities` endpoint'i, Elasticsearch'te tutulan etkinlikleri çekerek AI ile kazanım eşleştirmesi yapar ve MSSQL'deki `S_EtkinliklerSoru` tablosunu günceller.

**Özellik:** Toplu işlem desteği - Birden fazla etkinliği tek istekte işleyebilir.

## Kullanım

### Request Parametreleri (Tek Etkinlik)

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

### Request Parametreleri (Toplu İşlem - Aynı Ders)

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

### Request Parametreleri (Toplu İşlem - Farklı Dersler)

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

### Parametreler

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `bookId` | number | ✅ | Kitap ID (Elasticsearch sorgusu için) |
| `activities` | array | ✅ | Etkinlik listesi (en az 1 etkinlik) |
| `activities[].dersId` | number | ✅ | Ders ID (kazanımları çekmek için, her etkinlik için ayrı olabilir) |
| `activities[].activityIndex` | number | ✅ | Etkinlik indeksi (Elasticsearch filtreleme) |
| `activities[].etkinlikId` | number | ✅ | Etkinlik ID (MSSQL update için) |

## İşlem Akışı

### 1. Elasticsearch'ten Veri Çekme

```javascript
GET etkinlikler2/_search
{
  "query": {
    "bool": {
      "must": [
        { "term": { "bookId": 65366 } },
        { "term": { "activityIndex": 1 } }
      ]
    }
  }
}
```

**Dönen Veri Yapısı:**

```json
{
  "_source": {
    "activityIndex": 1,
    "pageNumber": 9,
    "activities": [
      {
        "id": 1,
        "text": "Etkinlik metni...",
        "rules": "Kurallar...",
        "answers": ["cevap1", "cevap2"]
      }
    ]
  }
}
```

### 2. GeneralId Hesaplama

Elasticsearch'ten gelen veriler sayfa bazında organize edilmiştir. Her sayfada etkinlik ID'leri 1'den başlar. Biz bu ID'leri tüm kitap genelinde benzersiz hale getiriyoruz:

**Algoritma:**

1. Tüm sayfaları `pageNumber`'a göre küçükten büyüğe sırala
2. Her sayfadaki etkinlikleri sırayla işle
3. `generalId` değerini 1'den başlat ve her etkinlik için arttır

**Örnek:**

```
Sayfa 9:
  - Etkinlik id: 1 → generalId: 1
  - Etkinlik id: 2 → generalId: 2

Sayfa 10:
  - Etkinlik id: 1 → generalId: 3
  - Etkinlik id: 2 → generalId: 4
```

### 3. AI ile Eşleştirme

Flatten edilmiş etkinlikler AI'ya gönderilir:

```
[1] Etkinlik metni 1...
[2] Etkinlik metni 2...
[3] Etkinlik metni 3...
```

AI, her etkinlik için uygun kazanımı bulur.

### 4. Veritabanı Güncelleme

`S_EtkinliklerSoru` tablosunda update yapılır:

```sql
UPDATE [dbo].[S_EtkinliklerSoru]
SET UniteId = @uniteId,
    KonuId = @konuId,
    KazanimId = @kazanimId
WHERE EtkinlikId = @etkinlikId 
  AND GenelSira = @genelSira
```

**Önemli Notlar:**

- Sadece `UniteId`, `KonuId`, `KazanimId` alanları güncellenir
- `UpdatedAt`, `UpdatedBy` ve diğer alanlar değiştirilmez
- `EtkinlikId` ve `GenelSira` ile kayıt bulunur

## Response Formatı

### Tek Etkinlik Response

```json
{
  "results": [
    {
      "activityIndex": 1,
      "etkinlikId": 7805,
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
      "updateResults": [
        {
          "generalId": 1,
          "updated": true
        },
        {
          "generalId": 2,
          "updated": true
        }
      ],
      "summary": {
        "total": 2,
        "updated": 2,
        "errors": 0
      }
    }
  ],
  "overallSummary": {
    "totalActivities": 1,
    "successfulActivities": 1,
    "failedActivities": 0,
    "totalUpdated": 2,
    "totalErrors": 0
  }
}
```

### Toplu İşlem Response

```json
{
  "results": [
    {
      "activityIndex": 1,
      "etkinlikId": 7805,
      "matchResults": [...],
      "updateResults": [...],
      "summary": {
        "total": 3,
        "updated": 3,
        "errors": 0
      }
    },
    {
      "activityIndex": 2,
      "etkinlikId": 7806,
      "matchResults": [...],
      "updateResults": [...],
      "summary": {
        "total": 5,
        "updated": 5,
        "errors": 0
      }
    },
    {
      "activityIndex": 3,
      "etkinlikId": 7807,
      "error": "No activities found for bookId: 65366, activityIndex: 3"
    }
  ],
  "overallSummary": {
    "totalActivities": 3,
    "successfulActivities": 2,
    "failedActivities": 1,
    "totalUpdated": 8,
    "totalErrors": 0
  }
}
```

## Hata Yönetimi

### 1. Parametre Eksikliği

```json
{
  "error": "bookId is required"
}
```

### 2. Elasticsearch Hatası

```json
{
  "error": "Internal server error",
  "message": "Failed to fetch activities from Elasticsearch"
}
```

### 3. Veri Bulunamadı

```json
{
  "error": "Internal server error",
  "message": "No activities found for bookId: 65366, activityIndex: 1"
}
```

### 4. Update Hatası

Bir etkinlikte hata olsa bile diğer etkinlikler işlenmeye devam eder. Hata detayları `updateResults` içinde döner.

## Örnek Kullanım Senaryoları

### Senaryo 1: Tek Etkinlik - Başarılı Güncelleme

```bash
# Request
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

# Response
{
  "overallSummary": {
    "totalActivities": 1,
    "successfulActivities": 1,
    "failedActivities": 0,
    "totalUpdated": 5,
    "totalErrors": 0
  }
}
```

### Senaryo 2: Toplu İşlem - Aynı Ders

```bash
# Request
{
  "bookId": 65366,
  "activities": [
    { "dersId": 31, "activityIndex": 1, "etkinlikId": 7805 },
    { "dersId": 31, "activityIndex": 2, "etkinlikId": 7806 },
    { "dersId": 31, "activityIndex": 3, "etkinlikId": 7807 }
  ]
}

# Response
{
  "overallSummary": {
    "totalActivities": 3,
    "successfulActivities": 3,
    "failedActivities": 0,
    "totalUpdated": 15,
    "totalErrors": 0
  }
}
```

### Senaryo 2.5: Toplu İşlem - Farklı Dersler

```bash
# Request (Türkçe ve Matematik etkinlikleri birlikte)
{
  "bookId": 65366,
  "activities": [
    { "dersId": 31, "activityIndex": 1, "etkinlikId": 7805 },
    { "dersId": 32, "activityIndex": 2, "etkinlikId": 7806 }
  ]
}

# Response
{
  "overallSummary": {
    "totalActivities": 2,
    "successfulActivities": 2,
    "failedActivities": 0,
    "totalUpdated": 8,
    "totalErrors": 0
  }
}
```

### Senaryo 3: Toplu İşlem - Kısmi Hata

```bash
# Bazı etkinlikler bulunamadı veya hata aldı
{
  "overallSummary": {
    "totalActivities": 3,
    "successfulActivities": 2,
    "failedActivities": 1,
    "totalUpdated": 10,
    "totalErrors": 0
  }
}
```

## Elasticsearch Yapılandırması

**Versiyon:** Elasticsearch 7.x

### Environment Variables

```env
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password
```

### İndeks Yapısı

**İndeks Adı:** `etkinlikler2`

**Mapping:**

```json
{
  "bookId": "number",
  "activityIndex": "number",
  "pageNumber": "number",
  "activities": [
    {
      "id": "number",
      "text": "string",
      "rules": "string",
      "answers": ["string"]
    }
  ]
}
```

## Logging

Console'da detaylı log mesajları görüntülenir:

```
Fetching activities from Elasticsearch (BookId: 65366, ActivityIndex: 1)
Found 5 activities
Updating database (EtkinlikId: 7805)
Updated GenelSira 1: UniteId=86, KonuId=1641, KazanimId=3636
Updated GenelSira 2: UniteId=86, KonuId=4218, KazanimId=3643
Update summary: 5 updated, 0 errors
```

## Test Etme

```powershell
# Test scripti çalıştır
.\test-activity-api.ps1
```

**Gereksinimler:**

- Elasticsearch çalışıyor olmalı
- `etkinlikler2` indeksi mevcut olmalı
- Belirtilen `bookId` ve `activityIndex` için veri bulunmalı
- `S_EtkinliklerSoru` tablosunda ilgili kayıtlar mevcut olmalı

## Performans Notları

- **Toplu İşlem:** Her etkinlik sırayla işlenir
- **Elasticsearch:** Her activityIndex için ayrı sorgu
- **AI Çağrısı:** Her etkinlik için ayrı AI çağrısı
- **Veritabanı Update:** Her etkinlik için sıralı update
- **Ortalama İşlem Süresi:** 
  - Tek etkinlik: 3-5 saniye
  - 3 etkinlik: 9-15 saniye
  - 10 etkinlik: 30-50 saniye
- **Hata Yönetimi:** Bir etkinlikte hata olsa bile diğerleri işlenmeye devam eder

## Sınırlamalar

- Elasticsearch connection timeout: 30 saniye
- Maksimum etkinlik sayısı: Sınırsız (ancak AI token limiti ~1M)
- MSSQL request timeout: 90 saniye
