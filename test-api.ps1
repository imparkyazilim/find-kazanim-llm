# PowerShell script to test the API

$body = @{
    dersId = 31
    questions = @(
        @{
            id = 1
            text = "Aşağıdaki cümlelerin hangisinde noktalama işareti yanlış kullanılmıştır?"
        },
        @{
            id = 2
            text = "Metinde hangi söz sanatı kullanılmıştır? Kişileştirme örneği gösteriniz."
        },
        @{
            id = 3
            text = "Dinlediğiniz metindeki ana fikir nedir?"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Testing /api/match-kazanim endpoint..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/match-kazanim" `
        -Method Post `
        -Body $body `
        -ContentType "application/json"
    
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
}
