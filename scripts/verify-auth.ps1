# ASTRA — end-to-end authentication verification
# Usage:  powershell -File scripts\verify-auth.ps1
# Needs:   docker compose up -d   (api on :8000, db on :5433, redis on :6379)
# Exit code: 0 = every check passed, otherwise number of failures.

$B = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { 'http://localhost:8000' }
$TMP = Join-Path $env:TEMP 'astra-api-response.json'
# Body goes through a file: PowerShell 5.1 mangles embedded quotes when passing
# JSON as a native command-line argument to curl.exe.
$REQ = Join-Path $env:TEMP 'astra-api-request.json'
$script:pass = 0
$script:fail = 0

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Body, [string]$Token)
    $c = @('-s', '-X', $Method, "$script:B$Path", '-o', $script:TMP, '-w', '%{http_code}')
    if ($Body)  { Set-Content -Path $script:REQ -Value $Body -NoNewline -Encoding Ascii
                  $c += @('-H', 'Content-Type: application/json', '-d', "@$($script:REQ)") }
    if ($Token) { $c += @('-H', "Authorization: Bearer $Token") }
    $status = & curl.exe @c
    $json = if (Test-Path $script:TMP) { Get-Content $script:TMP -Raw } else { '' }
    [pscustomobject]@{ status = [int]$status; json = $json }
}

function Show {
    param([string]$Name, $Result, [int]$Expect)
    $ok = $Result.status -eq $Expect
    if ($ok) { $script:pass++ } else { $script:fail++ }
    $mark = if ($ok) { 'PASS' } else { 'FAIL' }
    $body = ($Result.json -replace '\s+', ' ')
    if ($body.Length -gt 240) { $body = $body.Substring(0, 240) + '...' }
    Write-Host ("[{0}] {1}  ->  HTTP {2} (expected {3})" -f $mark, $Name, $Result.status, $Expect)
    if ($body) { Write-Host ("        {0}" -f $body) }
}

Write-Host "=== ASTRA auth E2E against $B ===" -ForegroundColor Cyan

# --- availability -----------------------------------------------------------
Show 'GET /health'  (Invoke-Api GET '/health')  200

# --- registration -----------------------------------------------------------
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$email1 = "hasan+$stamp@example.com"
$email2 = "salt+$stamp@example.com"
$pw = 'Str0ngPass!23'

$regBody = '{"email":"'+$email1+'","full_name":"Hasan Test","password":"'+$pw+'"}'
$r = Invoke-Api POST '/api/v1/auth/register' $regBody
Show 'POST /auth/register (new citizen)' $r 201

$r = Invoke-Api POST '/api/v1/auth/register' $regBody
Show 'POST /auth/register (duplicate email -> 409)' $r 409

$r = Invoke-Api POST '/api/v1/auth/register' ('{"email":"'+$email2+'","full_name":"Salt Check","password":"'+$pw+'"}')
Show 'POST /auth/register (second user, SAME password)' $r 201

# --- login ------------------------------------------------------------------
$r = Invoke-Api POST '/api/v1/auth/login' ('{"email":"'+$email1+'","password":"'+$pw+'"}')
Show 'POST /auth/login (correct password)' $r 200
$tokens = $null
if ($r.status -eq 200) { $tokens = $r.json | ConvertFrom-Json }

$r = Invoke-Api POST '/api/v1/auth/login' ('{"email":"'+$email1+'","password":"Wr0ngPass!23"}')
Show 'POST /auth/login (wrong password -> 401)' $r 401

$r = Invoke-Api POST '/api/v1/auth/login' ('{"email":"nobody+'+$stamp+'@example.com","password":"Whatever123"}')
Show 'POST /auth/login (unknown email -> 401, no enumeration)' $r 401

# --- token protection -------------------------------------------------------
$r = Invoke-Api GET '/api/v1/auth/me'
Show 'GET /auth/me without token -> 401' $r 401

$r = Invoke-Api GET '/api/v1/auth/me' $null $tokens.access_token
Show 'GET /auth/me with access token' $r 200
$me = $null
if ($r.status -eq 200) { $me = $r.json | ConvertFrom-Json }
if ($me) {
    Write-Host ("        user: {0} | role: {1} | permissions: {2}" -f $me.email, $me.role, ($me.permissions -join ', '))
    if ($me.role -eq 'CITIZEN' -and ($me.permissions -contains 'report.create') -and -not ($me.permissions -contains 'incident.close')) {
        $script:pass++; Write-Host '[PASS] RBAC: citizen has report.create, lacks incident.close'
    } else {
        $script:fail++; Write-Host '[FAIL] RBAC permission set wrong for CITIZEN'
    }
}

$r = Invoke-Api GET '/api/v1/auth/me' $null $tokens.refresh_token
Show 'GET /auth/me with REFRESH token as access -> 401' $r 401

if ($tokens.access_token) {
    $tampered = $tokens.access_token.Substring(0, $tokens.access_token.Length - 2) + 'xx'
    $r = Invoke-Api GET '/api/v1/auth/me' $null $tampered
    Show 'GET /auth/me with tampered token -> 401' $r 401
}

# --- refresh flow (AD-2) ----------------------------------------------------
$r = Invoke-Api POST '/api/v1/auth/refresh' ('{"refresh_token":"'+$tokens.refresh_token+'"}')
Show 'POST /auth/refresh issues a fresh pair' $r 200
if ($r.status -eq 200) {
    $fresh = $r.json | ConvertFrom-Json
    $r = Invoke-Api GET '/api/v1/auth/me' $null $fresh.access_token
    Show 'new access token works' $r 200
}

$r = Invoke-Api POST '/api/v1/auth/refresh' '{"refresh_token":"not-a-jwt"}'
Show 'POST /auth/refresh with garbage -> 401' $r 401

# --- salt proof: same password must produce different hashes ----------------
$hash = docker exec astra-db-1 psql -U postgres -d astra -t -A -c `
    ("select string_agg(left(password_hash,60), ' | ') from (select password_hash from users where email in ('"+$email1+"','"+$email2+"') order by email) s;")
Write-Host "        stored hash prefixes: $hash"
$parts = @($hash -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($parts.Count -eq 2 -and $parts[0] -ne $parts[1] -and $parts[0].StartsWith('$argon2id$')) {
    $script:pass++; Write-Host '[PASS] argon2id hashes: same password -> different salts'
} else {
    $script:fail++; Write-Host '[FAIL] salt check did not pass'
}

Write-Host ''
Write-Host ("=== RESULT: {0} passed, {1} failed ===" -f $script:pass, $script:fail) -ForegroundColor $(if ($script:fail -eq 0) {'Green'} else {'Red'})
exit $script:fail
