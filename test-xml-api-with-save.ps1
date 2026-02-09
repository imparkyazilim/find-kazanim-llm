# PowerShell script to test the XML API endpoint with save functionality

Write-Host "=== Test 1: Without Save ===" -ForegroundColor Cyan
Write-Host ""

$bodyNoSave = @{
    dersId = 31
    testXmlPath = "c:\GitHub\find-kazanim-llm\example-test.xml"
    testSira = 0
    save = $false
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $bodyNoSave
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-kazanim-from-xml" `
        -Method Post `
        -Body $bodyNoSave `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
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

Write-Host "=== Test 2: With Save ===" -ForegroundColor Cyan
Write-Host ""

$bodyWithSave = @{
    dersId = 31
    testXmlPath = "c:\GitHub\find-kazanim-llm\example-test.xml"
    testSira = 0
    save = $true
    kitapId = 3943
    testId = 143584
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $bodyWithSave
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-kazanim-from-xml" `
        -Method Post `
        -Body $bodyWithSave `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Magenta
    Write-Host "  Total: $($response.summary.total)" -ForegroundColor White
    Write-Host "  Saved: $($response.summary.saved)" -ForegroundColor Green
    Write-Host "  Skipped: $($response.summary.skipped)" -ForegroundColor Yellow
    Write-Host "  Errors: $($response.summary.errors)" -ForegroundColor Red
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

Write-Host "=== Test 3: With Save but Missing Parameters (Error Test) ===" -ForegroundColor Cyan
Write-Host ""

$bodyError = @{
    dersId = 31
    testXmlPath = "c:\GitHub\find-kazanim-llm\example-test.xml"
    testSira = 0
    save = $true
    # kitapId and testId are missing - should return error
} | ConvertTo-Json -Depth 10

Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $bodyError
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-kazanim-from-xml" `
        -Method Post `
        -Body $bodyError `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected Error Received:" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody -ForegroundColor Yellow
    }
}
