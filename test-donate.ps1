# Test 1 - One-time donation
# Run from classroom directory: .\test-donate.ps1

$body = @{
    campaign_id = "73ada271-313b-405e-a931-461aba9af22b"
    amount = 1000
    donor_name = "Test Donor"
    donor_email = "test@example.com"
    return_url = "https://www.bayaan.app/thank-you"
} | ConvertTo-Json

Write-Host "Sending donation request..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "https://www.bayaan.app/api/donate/one-time" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    Write-Host "`nSUCCESS:" -ForegroundColor Green
    $response | ConvertTo-Json
    Write-Host "`nCheckout URL:" -ForegroundColor Yellow
    Write-Host $response.checkout_url
}
catch {
    Write-Host "`nERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host "Response body:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message
    }
}
