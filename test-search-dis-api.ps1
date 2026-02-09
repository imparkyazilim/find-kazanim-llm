# PowerShell script to test the Dis Kazanim Search API endpoint

Write-Host "=== Testing /api/search-kazanim-dis endpoint ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Single Query
Write-Host "Test 1: Single Query (Dis Kazanimlar)" -ForegroundColor Yellow
Write-Host ""

$bodySingle = @{
    dersId = 34
    topK = 5
    queries = @(
        @{
            id = 1
            text = "matematik işlemleri"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodySingle
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/search-kazanim-dis" `
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
Write-Host "Test 2: Multiple Queries (Dis Kazanimlar)" -ForegroundColor Yellow
Write-Host ""

$bodyMultiple = @{
    dersId = 34
    topK = 3
    queries = @(
        @{
            id = 1
            text = "matematik işlemleri"
        },
        @{
            id = 2
            text = "geometri ve şekiller"
        },
        @{
            id = 3
            text = "problem çözme stratejileri"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodyMultiple
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/search-kazanim-dis" `
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
Write-Host "Note: This endpoint searches S_DisKazanimlar table" -ForegroundColor Yellow
Write-Host "Make sure dersId 34 exists in S_DisKazanimlar table" -ForegroundColor Yellow
