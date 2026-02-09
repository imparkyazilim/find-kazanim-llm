# PowerShell script to test the XML API endpoint

# Test with local file path
$body = @{
    dersId = 31
    testXmlPath = "c:\GitHub\find-kazanim-llm\example-test.xml"
    testSira = 0
} | ConvertTo-Json -Depth 10

Write-Host "Testing /api/match-kazanim-from-xml endpoint with local file..." -ForegroundColor Cyan
Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $body
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-kazanim-from-xml" `
        -Method Post `
        -Body $body `
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
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test with HTTP URL (example - update with your actual URL)
$bodyUrl = @{
    dersId = 31
    testXmlPath = "https://example.com/test.xml"
    testSira = 0
} | ConvertTo-Json -Depth 10

Write-Host "Example with HTTP URL:" -ForegroundColor Cyan
Write-Host $bodyUrl
Write-Host ""
Write-Host "(Update the URL in test-xml-api.ps1 to test with actual HTTP endpoint)" -ForegroundColor Yellow
