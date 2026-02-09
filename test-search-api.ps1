# PowerShell script to test the Kazanim Search API endpoint

Write-Host "=== Testing /api/search-kazanim endpoint ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Single Query
Write-Host "Test 1: Single Query" -ForegroundColor Yellow
Write-Host ""

$bodySingle = @{
    dersId = 31
    topK = 5
    queries = @(
        @{
            id = 1
            text = "noktalama işaretleri"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodySingle
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/search-kazanim" `
        -Method Post `
        -Body $bodySingle `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    
    if ($response.results -and $response.results.Count -gt 0) {
        $firstResult = $response.results[0]
        Write-Host "Query: $($firstResult.queryText)" -ForegroundColor Magenta
        Write-Host "Found $($firstResult.matches.Count) matches:" -ForegroundColor White
        foreach ($match in $firstResult.matches) {
            Write-Host "  - Confidence: $($match.confidenceScore)% | Kazanim: $($match.kazanimText.Substring(0, [Math]::Min(80, $match.kazanimText.Length)))..." -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Test 2: Multiple Queries
Write-Host "Test 2: Multiple Queries" -ForegroundColor Yellow
Write-Host ""

$bodyMultiple = @{
    dersId = 31
    topK = 3
    queries = @(
        @{
            id = 1
            text = "noktalama işaretleri"
        },
        @{
            id = 2
            text = "metindeki söz sanatları"
        },
        @{
            id = 3
            text = "dinleme becerileri ve stratejileri"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodyMultiple
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/search-kazanim" `
        -Method Post `
        -Body $bodyMultiple `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    
    Write-Host "Summary:" -ForegroundColor Magenta
    Write-Host "  Total Queries: $($response.summary.totalQueries)" -ForegroundColor White
    Write-Host "  Top K: $($response.summary.topK)" -ForegroundColor White
    Write-Host ""
    
    foreach ($result in $response.results) {
        Write-Host "Query $($result.queryId): `"$($result.queryText)`"" -ForegroundColor Yellow
        Write-Host "  Found $($result.matches.Count) matches:" -ForegroundColor White
        foreach ($match in $result.matches) {
            Write-Host "    - [$($match.confidenceScore)%] KazanimId: $($match.kazanimId)" -ForegroundColor Cyan
        }
        Write-Host ""
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Test 3: Custom TopK
Write-Host "Test 3: Custom TopK (10 results)" -ForegroundColor Yellow
Write-Host ""

$bodyCustom = @{
    dersId = 31
    topK = 10
    queries = @(
        @{
            id = 1
            text = "yazma becerileri"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodyCustom
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/search-kazanim" `
        -Method Post `
        -Body $bodyCustom `
        -ContentType "application/json"
    
    Write-Host "Response Summary:" -ForegroundColor Green
    Write-Host "  Requested TopK: $($response.summary.topK)" -ForegroundColor White
    Write-Host "  Actual Results: $($response.results[0].matches.Count)" -ForegroundColor White
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: This endpoint performs semantic search on kazanim database" -ForegroundColor Yellow
Write-Host "It returns the most relevant kazanimlar with confidence scores" -ForegroundColor Yellow
