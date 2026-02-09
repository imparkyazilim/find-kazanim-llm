# Kazanim Search Feature Documentation

## Genel Bakış

`/api/search-kazanim` endpoint'i, kullanıcının arama metnine göre semantik benzerlik ile en uygun kazanımları bulur ve doğruluk oranıyla birlikte döndürür.

**Problem:** Kullanıcı kazanım aramak istiyor ama aradığı kelime kazanım metninde geçmiyor. Fuzzy search yetersiz kalıyor.

**Çözüm:** AI ile semantik arama - anlam benzerliğine göre en uygun kazanımları bulma.

## Kullanım

### Request Parametreleri

```json
{
  "dersId": 31,
  "topK": 5,
  "queries": [
    {
      "id": 1,
      "text": "noktalama işaretleri"
    },
    {
      "id": 2,
      "text": "metindeki söz sanatları"
    }
  ]
}
```

### Parametreler

| Parametre | Tip | Zorunlu | Varsayılan | Açıklama |
|-----------|-----|---------|------------|----------|
| `dersId` | number | ✅ | - | Ders ID (kazanımları çekmek için) |
| `topK` | number | ❌ | 5 | Kaç adet sonuç isteniyor |
| `queries` | array | ✅ | - | Arama sorguları (en az 1) |
| `queries[].id` | number/string | ✅ | - | Sorgu ID |
| `queries[].text` | string | ✅ | - | Arama metni |

## Response Formatı

### Başarılı Response

```json
{
  "results": [
    {
      "queryId": 1,
      "queryText": "noktalama işaretleri",
      "matches": [
        {
          "uniteId": 86,
          "konuId": 1641,
          "kazanimId": 3636,
          "kazanimText": "Ünite [86]: T.7.3. OKUMA | Konu [1641]: T.7.3.1. Noktalama işaretlerine dikkat ederek sesli ve sessiz okur. | Kazanım [3636]: T.7.3.1.1. Nokta, virgül, iki nokta, noktalı virgül, üç nokta, soru işareti, ünlem",
          "confidenceScore": 95
        },
        {
          "uniteId": 86,
          "konuId": 1641,
          "kazanimId": 11500,
          "kazanimText": "Ünite [86]: T.7.3. OKUMA | Konu [1641]: T.7.3.1. Noktalama işaretlerine dikkat ederek sesli ve sessiz okur. | Kazanım [11500]: T.7.3.1.2. Tırnak işareti, kesme işareti, yay ayraç, kısa çizgi, uzun çizgi, eğik çizgi",
          "confidenceScore": 92
        },
        {
          "uniteId": 86,
          "konuId": 1641,
          "kazanimId": 11501,
          "kazanimText": "Ünite [86]: T.7.3. OKUMA | Konu [1641]: T.7.3.1. Noktalama işaretlerine dikkat ederek sesli ve sessiz okur. | Kazanım [11501]: T.7.3.1.3. Noktalama işaretleri karma soruları kavrar.",
          "confidenceScore": 88
        }
      ]
    }
  ],
  "summary": {
    "totalQueries": 1,
    "topK": 5
  }
}
```

### Confidence Score Açıklaması

| Puan Aralığı | Açıklama | Kullanım Önerisi |
|--------------|----------|------------------|
| 90-100 | Mükemmel eşleşme | Direkt kullanılabilir |
| 75-89 | Çok iyi eşleşme | Güvenle kullanılabilir |
| 60-74 | İyi eşleşme | Kontrol edilmeli |
| 40-59 | Orta eşleşme | Dikkatli kullanılmalı |
| 0-39 | Zayıf eşleşme | Kullanılmamalı |

## Özellikler

### 1. Semantik Arama

Tam kelime eşleşmesi gerekmez, anlam benzerliği önemlidir:

**Örnek 1:**
- Arama: "noktalama işaretleri"
- Bulur: "Noktalama işaretlerine dikkat ederek sesli ve sessiz okur"
- Confidence: 95%

**Örnek 2:**
- Arama: "dinleme becerileri"
- Bulur: "Dinleme stratejilerini uygular"
- Confidence: 87%

**Örnek 3:**
- Arama: "yazma teknikleri"
- Bulur: "Yazma stratejilerini uygular"
- Confidence: 89%

### 2. Toplu Arama

Birden fazla sorguyu tek istekte işleyebilir:

```json
{
  "dersId": 31,
  "queries": [
    { "id": 1, "text": "noktalama" },
    { "id": 2, "text": "söz sanatları" },
    { "id": 3, "text": "dinleme" }
  ]
}
```

Her sorgu için ayrı sonuç listesi döner.

### 3. Esnek TopK

İstediğiniz kadar sonuç alabilirsiniz:

```json
{
  "dersId": 31,
  "topK": 10,  // 10 sonuç
  "queries": [...]
}
```

## Kullanım Senaryoları

### Senaryo 1: Öğretmen Kazanım Arama

**Durum:** Öğretmen "yazma becerileri" ile ilgili kazanımları arıyor.

```json
{
  "dersId": 31,
  "topK": 5,
  "queries": [
    {
      "id": 1,
      "text": "yazma becerileri"
    }
  ]
}
```

**Sonuç:** Yazma ile ilgili tüm kazanımlar confidence score ile gelir.

### Senaryo 2: Soru Bankası Etiketleme

**Durum:** Soru bankasındaki soruları kazanımlarla eşleştirmek istiyoruz.

```json
{
  "dersId": 31,
  "topK": 3,
  "queries": [
    { "id": 1, "text": "metindeki noktalama hatalarını bulma" },
    { "id": 2, "text": "şiirdeki benzetmeleri tespit etme" },
    { "id": 3, "text": "dinlediği metni özetleme" }
  ]
}
```

**Sonuç:** Her soru için en uygun 3 kazanım önerilir.

### Senaryo 3: Müfredat Analizi

**Durum:** Belirli bir konuyla ilgili tüm kazanımları bulmak istiyoruz.

```json
{
  "dersId": 31,
  "topK": 10,
  "queries": [
    { "id": 1, "text": "okuma stratejileri ve teknikleri" }
  ]
}
```

**Sonuç:** Okuma ile ilgili 10 kazanım confidence score ile gelir.

## Hata Yönetimi

### 1. Parametre Eksikliği

```json
{
  "error": "dersId is required"
}
```

### 2. Boş Queries

```json
{
  "error": "queries array is required and must not be empty"
}
```

### 3. Kazanım Bulunamadı

```json
{
  "error": "Internal server error",
  "message": "No kazanim found for dersId: 999"
}
```

### 4. AI Parse Hatası

Bir sorgu için AI yanıtı parse edilemezse, o sorgu için boş matches döner:

```json
{
  "results": [
    {
      "queryId": 1,
      "queryText": "...",
      "matches": []  // Parse hatası
    }
  ]
}
```

## Performans

### İşlem Süreleri

- **Tek sorgu:** ~2-3 saniye
- **3 sorgu:** ~6-9 saniye
- **10 sorgu:** ~20-30 saniye

### Optimizasyon İpuçları

1. **Toplu İşlem:** Birden fazla arama varsa, hepsini tek istekte gönderin
2. **TopK Ayarı:** Sadece ihtiyacınız kadar sonuç isteyin (topK=3 daha hızlı)
3. **Cache:** Sık aranan terimler için sonuçları cache'leyebilirsiniz

## Karşılaştırma: Fuzzy Search vs Semantic Search

### Fuzzy Search (Klasik)

```
Arama: "noktalama"
Sonuç: Sadece "noktalama" kelimesi geçen kazanımlar
Eksik: "Virgül kullanımı", "Nokta işareti" gibi ilgili kazanımları bulamaz
```

### Semantic Search (Bu Endpoint)

```
Arama: "noktalama"
Sonuç: 
  - "Noktalama işaretlerine dikkat ederek okur" (95%)
  - "Virgül, nokta kullanımı" (88%)
  - "Yazım kuralları" (72%)
Avantaj: Anlam benzerliğine göre tüm ilgili kazanımları bulur
```

## Logging

Console'da detaylı log mesajları:

```
Searching 3 queries for DersId: 31, TopK: 5
Searching for query 1: "noktalama işaretleri"
Found 5 matches for query 1
Searching for query 2: "söz sanatları"
Found 5 matches for query 2
Searching for query 3: "dinleme becerileri"
Found 5 matches for query 3
```

## Test Etme

```powershell
# Test scripti çalıştır
.\test-search-api.ps1
```

**Test Senaryoları:**
1. Tek sorgu ile arama
2. Birden fazla sorgu ile arama
3. Custom topK değeri ile arama

## Sınırlamalar

- **AI Token Limiti:** Çok fazla kazanım varsa (>1000), performans düşebilir
- **Dil:** Sadece Türkçe kazanımlar için optimize edilmiştir
- **Confidence Score:** AI tarafından hesaplanır, subjektif olabilir
- **TopK Limiti:** Çok yüksek topK değerleri (>20) önerilmez

## Gelecek Geliştirmeler

- [ ] Cache mekanizması (sık aranan terimler için)
- [ ] Batch processing optimizasyonu
- [ ] Farklı diller için destek
- [ ] Confidence score kalibrasyonu
- [ ] Arama geçmişi ve analitik
