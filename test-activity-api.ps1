# PowerShell script to test the Activity API endpoint (Batch Processing)

Write-Host "=== Testing /api/match-activities endpoint (Batch) ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Single Activity
Write-Host "Test 1: Single Activity" -ForegroundColor Yellow
Write-Host ""

$bodySingle = @{
    bookId = 65366
    activities = @(
        @{
            dersId = 31
            activityIndex = 1
            etkinlikId = 7805
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodySingle
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-activities" `
        -Method Post `
        -Body $bodySingle `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Overall Summary:" -ForegroundColor Magenta
    Write-Host "  Total Activities: $($response.overallSummary.totalActivities)" -ForegroundColor White
    Write-Host "  Successful: $($response.overallSummary.successfulActivities)" -ForegroundColor Green
    Write-Host "  Failed: $($response.overallSummary.failedActivities)" -ForegroundColor Red
    Write-Host "  Total Updated: $($response.overallSummary.totalUpdated)" -ForegroundColor Green
    Write-Host "  Total Errors: $($response.overallSummary.totalErrors)" -ForegroundColor Red
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

# Test 2: Multiple Activities
Write-Host "Test 2: Multiple Activities (Batch)" -ForegroundColor Yellow
Write-Host ""

$bodyBatch = @{
    bookId = 65366
    activities = @(
        @{
            dersId = 31
            activityIndex = 1
            etkinlikId = 7805
        },
        @{
            dersId = 31
            activityIndex = 2
            etkinlikId = 7806
        },
        @{
            dersId = 32
            activityIndex = 3
            etkinlikId = 7807
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $bodyBatch
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-activities" `
        -Method Post `
        -Body $bodyBatch `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Overall Summary:" -ForegroundColor Magenta
    Write-Host "  Total Activities: $($response.overallSummary.totalActivities)" -ForegroundColor White
    Write-Host "  Successful: $($response.overallSummary.successfulActivities)" -ForegroundColor Green
    Write-Host "  Failed: $($response.overallSummary.failedActivities)" -ForegroundColor Red
    Write-Host "  Total Updated: $($response.overallSummary.totalUpdated)" -ForegroundColor Green
    Write-Host "  Total Errors: $($response.overallSummary.totalErrors)" -ForegroundColor Red
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

Write-Host "Note: Make sure Elasticsearch is running and accessible" -ForegroundColor Yellow
Write-Host "Update the bookId, activityIndex, and etkinlikId values with actual data" -ForegroundColor Yellow
