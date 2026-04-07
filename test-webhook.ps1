# Manually simulate a Pay.nl exchange webhook.
# Proves our webhook handler works independently of Pay.nl.
#
# Usage:
#   .\test-webhook.ps1 -OrderId "51517387005X143d"
#
# Before running: set $Token to your actual PAYNL_EXCHANGE_SECRET value.

param(
    [Parameter(Mandatory=$true)]
    [string]$OrderId
)

$Token = "e37dfb620adbebb6cbc872ee600488f594e44bf3"
$BaseUrl = "https://classroom-umber.vercel.app/api/webhook/pay"

Write-Host "`n=== Test 1: GET with query params (legacy format) ===" -ForegroundColor Cyan
$getUrl = "$BaseUrl" + "?token=$Token&action=new_ppt&order_id=$OrderId&amount=10.00"
Write-Host "GET $getUrl`n"
try {
    $response = Invoke-WebRequest -Uri $getUrl -Method Get -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Body: $($response.Content)" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test 2: POST with form-encoded body ===" -ForegroundColor Cyan
$postUrl = "$BaseUrl" + "?token=$Token"
$formBody = "action=new_ppt&order_id=$OrderId&amount=10.00"
Write-Host "POST $postUrl"
Write-Host "Body: $formBody`n"
try {
    $response = Invoke-WebRequest `
        -Uri $postUrl `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $formBody `
        -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Body: $($response.Content)" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nNow check Supabase:" -ForegroundColor Yellow
Write-Host "  SELECT status, paid_at FROM transactions WHERE paynl_order_id = '$OrderId';"
Write-Host "  SELECT action, payload FROM exchange_events ORDER BY processed_at DESC LIMIT 5;"
