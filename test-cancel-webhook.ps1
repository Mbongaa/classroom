# Simulate a Pay.nl TGU "order cancelled" webhook for an existing order.
#
# Why this exists: Pay.nl sandbox does NOT fire a real cancel webhook when a
# user abandons checkout — orders just sit in PENDING until the 7-day expiry
# kicks in. To verify our handler reacts to cancel events without waiting a
# week, we replay a synthetic TGU payload that mimics what Pay.nl would
# actually send when an order expires or is voided via API.
#
# Usage:
#   .\test-cancel-webhook.ps1 -OrderId "51616486001X1452"
#
# After running, check Supabase:
#   SELECT status FROM transactions WHERE paynl_order_id = '<order_id>';
#   → expected: 'CANCEL'

param(
    [Parameter(Mandatory = $true)]
    [string]$OrderId
)

$Token = "e37dfb620adbebb6cbc872ee600488f594e44bf3"
$BaseUrl = "https://classroom-umber.vercel.app/api/webhook/pay"

# Pay.nl TGU sends form-encoded bracket-notation fields. We mirror the exact
# shape from a real captured payload, with object[status][action] = CANCELLED
# (which our parser maps to order.cancelled, status code -90 in Pay.nl land).
$bodyFields = @{
    'event'                          = 'status_changed'
    'type'                           = 'order'
    'version'                        = '1'
    'id'                             = "synthetic-$([guid]::NewGuid())"
    'object[id]'                     = "synthetic-$([guid]::NewGuid())"
    'object[type]'                   = 'sale'
    'object[orderId]'                = $OrderId
    'object[status][action]'         = 'CANCELLED'
    'object[status][code]'           = '-90'
    'object[amount][value]'          = '1000'
    'object[amount][currency]'       = 'EUR'
}

# URL-encode each pair into a www-form-urlencoded body.
$encodedPairs = @()
foreach ($key in $bodyFields.Keys) {
    $encKey = [uri]::EscapeDataString($key)
    $encVal = [uri]::EscapeDataString($bodyFields[$key])
    $encodedPairs += "$encKey=$encVal"
}
$body = $encodedPairs -join '&'

$url = "$BaseUrl" + "?token=$Token"

Write-Host "POST $url" -ForegroundColor Cyan
Write-Host "Body: $body`n" -ForegroundColor DarkGray

try {
    $response = Invoke-WebRequest `
        -Uri $url `
        -Method Post `
        -ContentType 'application/x-www-form-urlencoded' `
        -Body $body `
        -UseBasicParsing

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Body:   $($response.Content)" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

Write-Host "`nNow query Supabase:" -ForegroundColor Yellow
Write-Host "  SELECT status FROM transactions WHERE paynl_order_id = '$OrderId';"
Write-Host "  SELECT action FROM exchange_events ORDER BY processed_at DESC LIMIT 3;"
