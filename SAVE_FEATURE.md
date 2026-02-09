# Save Feature Documentation

## Genel Bakış

`/api/match-kazanim-from-xml` endpoint'ine eklenen `save` özelliği, AI tarafından eşleştirilen kazanımları otomatik olarak `S_CaprazGorevHistoryKazanim` tablosuna kaydeder.

## Kullanım

### Request Parametreleri

```json
{
  "dersId": 31,
  "testXmlPath": "path/to/test.xml",
  "testSira": 0,
  "save": true,           // Kaydetme özelliğini aktifleştirir
  "kitapId": 3943,        // save=true ise zorunlu
  "testId": 143584        // save=true ise zorunlu
}
```

### Validasyon Kuralları

1. `save=true` ise `kitapId` ve `testId` zorunludur
2. `save=false` veya belirtilmemişse, sadece eşleştirme yapılır

## Veritabanı İşlemleri

### 1. Kontrol Aşaması

Her soru için kaydetmeden önce kontrol yapılır:

```sql
SELECT COUNT(*) as RecordCount
FROM [dbo].[S_CaprazGorevHistoryKazanim]
WHERE KitapId = @kitapId 
  AND TestId = @testId 
  AND SoruId = @soruId
```

- Kayıt varsa → `skipped: true` (Atlama)
- Kayıt yoksa → Yeni kayıt ekleme

### 2. Insert İşlemi

Yeni kayıt için eklenen alanlar:

| Alan | Kaynak | Değer |
|------|--------|-------|
| `UniteId` | AI Response | Eşleştirilen ünite ID |
| `KonuId` | AI Response | Eşleştirilen konu ID |
| `KazanimId` | AI Response | Eşleştirilen kazanım ID |
| `KitapId` | Request Body | Kullanıcı tarafından gönderilen |
| `TestId` | Request Body | Kullanıcı tarafından gönderilen |
| `SoruId` | AI Response (id) | Soru numarası |
| `ZorlukDuzeyi` | Sabit | 3 (default) |
| `CreatedBy` | Sabit | 109 |
| `CreatedAt` | Otomatik | Şu anki zaman |
| `CRT_TST` | Otomatik | Şu anki zaman |

Diğer alanlar (`OgretmenId`, `YazarId`, `ZorlukModeli`, vb.) `NULL` olarak bırakılır.

## Response Formatı

### save=false (Sadece Eşleştirme)

```json
[
  {
    "id": 1,
    "uniteId": 86,
    "konuId": 1641,
    "kazanimId": 3636
  }
]
```

### save=true (Eşleştirme + Kaydetme)

```json
{
  "matchResults": [
    {
      "id": 1,
      "uniteId": 86,
      "konuId": 1641,
      "kazanimId": 3636
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
    },
    {
      "soruId": 3,
      "saved": false,
      "skipped": false,
      "reason": "Database connection error"
    }
  ],
  "summary": {
    "total": 3,
    "saved": 1,
    "skipped": 1,
    "errors": 1
  }
}
```

## Save Result Durumları

| Durum | saved | skipped | reason | Açıklama |
|-------|-------|---------|--------|----------|
| Başarılı | `true` | `false` | - | Kayıt başarıyla eklendi |
| Atlandı | `false` | `true` | "Record already exists..." | Kayıt zaten mevcut |
| Hata | `false` | `false` | Error mesajı | Kaydetme sırasında hata oluştu |

## Hata Yönetimi

### 1. Parametre Eksikliği

```json
{
  "error": "kitapId is required when save is true"
}
```

### 2. Veritabanı Hatası

Bir soruda hata olsa bile diğer sorular işlenmeye devam eder. Hata detayları `saveResults` içinde döner.

## Örnek Kullanım Senaryoları

### Senaryo 1: İlk Kayıt

```bash
# Request
{
  "save": true,
  "kitapId": 3943,
  "testId": 143584
}

# Response
{
  "summary": {
    "total": 5,
    "saved": 5,      # Tüm sorular kaydedildi
    "skipped": 0,
    "errors": 0
  }
}
```

### Senaryo 2: Tekrar Çalıştırma

```bash
# Request (aynı kitapId ve testId ile)
{
  "save": true,
  "kitapId": 3943,
  "testId": 143584
}

# Response
{
  "summary": {
    "total": 5,
    "saved": 0,      # Hiçbiri kaydedilmedi
    "skipped": 5,    # Hepsi zaten mevcut
    "errors": 0
  }
}
```

### Senaryo 3: Kısmi Güncelleme

```bash
# Bazı sorular daha önce kaydedilmiş
{
  "summary": {
    "total": 5,
    "saved": 2,      # 2 yeni soru kaydedildi
    "skipped": 3,    # 3 soru zaten vardı
    "errors": 0
  }
}
```

## Logging

Console'da detaylı log mesajları görüntülenir:

```
Parsing XML from: c:\path\to\test.xml
Looking for test with ID: 0
Found 5 questions in test 0
Saving results to database (KitapId: 3943, TestId: 143584)
Saved SoruId 1: UniteId=86, KonuId=1641, KazanimId=3636
Skipping SoruId 2: Record already exists (KitapId: 3943, TestId: 143584)
Save summary: 4 saved, 1 skipped, 0 errors
```

## Test Etme

```powershell
# Test scripti çalıştır
.\test-xml-api-with-save.ps1
```

Script 3 test yapar:
1. `save=false` ile normal eşleştirme
2. `save=true` ile kaydetme
3. `save=true` ama parametreler eksik (hata testi)
