# ASTRA — Module 1 dispatch-arc verification (real stack, no mocks)
# Usage:  powershell -File scripts\verify-module1.ps1
# Needs:   docker compose up -d   (api on :8000, db on :5433, redis on :6379)
#          DEMO_MODE=true + the seeded demo accounts (code/.env)
# Exit code: 0 = every check passed, otherwise number of failures.
#
# This is the "does the dispatch arc actually work against the running
# server" gate. It uses curl.exe against http://localhost:8000, so it
# exercises routing, auth, RBAC, the DB and the real write paths -- not the
# in-process TestClient.

param(
    [string]$ApiBaseUrl = $(if ($env:API_BASE_URL) { $env:API_BASE_URL } else { 'http://localhost:8000' }),
    [string]$AdminEmail = 'admin@astra.dev',
    [string]$TeamEmail = 'team@astra.dev',
    [string]$CitizenEmail = 'citizen@astra.dev',
    [string]$Department = 'Fire & Rescue'
)

$script:B = $ApiBaseUrl
$script:pass = 0
$script:fail = 0
$TMP = Join-Path $env:TEMP 'astra-module1-resp.json'
$REQ = Join-Path $env:TEMP 'astra-module1-req.json'

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Body, [string]$Token)
    $c = @('-s', '-X', $Method, "$script:B$Path", '-o', $TMP, '-w', '%{http_code}')
    if ($Body) {
        Set-Content -Path $REQ -Value $Body -NoNewline -Encoding Ascii
        $c += @('-H', 'Content-Type: application/json', '-d', "@$REQ")
    }
    if ($Token) { $c += @('-H', "Authorization: Bearer $Token") }
    $status = & curl.exe @c
    $json = if (Test-Path $TMP) { Get-Content $TMP -Raw } else { '' }
    [pscustomobject]@{ status = [int]$status; json = $json }
}

function Invoke-Multipart {
    param([string]$Path, [hashtable]$Fields, [string]$Token)
    $c = @('-s', '-X', 'POST', "$script:B$Path", '-o', $TMP, '-w', '%{http_code}')
    foreach ($k in $Fields.Keys) { $c += @('-F', "$k=$($Fields[$k])") }
    if ($Token) { $c += @('-H', "Authorization: Bearer $Token") }
    $status = & curl.exe @c
    $json = if (Test-Path $TMP) { Get-Content $TMP -Raw } else { '' }
    [pscustomobject]@{ status = [int]$status; json = $json }
}

function Show {
    param([string]$Name, $Result, [int]$Expect)
    $ok = $Result.status -eq $Expect
    if ($ok) { $script:pass++ } else { $script:fail++ }
    $mark = if ($ok) { 'PASS' } else { 'FAIL' }
    $body = ($Result.json -replace '\s+', ' ')
    if ($body.Length -gt 220) { $body = $body.Substring(0, 220) + '...' }
    Write-Host ("[{0}] {1}  ->  HTTP {2} (expected {3})" -f $mark, $Name, $Result.status, $Expect)
    if ($body) { Write-Host ("        {0}" -f $body) }
}

function Get-Prop {
    param([string]$Json, [string]$Name)
    try { return ($Json | ConvertFrom-Json).$Name } catch { return $null }
}

Write-Host "=== ASTRA Module 1 dispatch arc against $script:B ===" -ForegroundColor Cyan

# --- availability ------------------------------------------------------------
Show 'GET /health' (Invoke-Api GET '/health') 200

# --- identities --------------------------------------------------------------
$r = Invoke-Api POST '/api/v1/auth/demo-login' ('{"email":"' + $AdminEmail + '"}')
Show "POST /auth/demo-login ($AdminEmail)" $r 200
$admin = $null
if ($r.status -eq 200) { $admin = Get-Prop $r.json 'access_token' }

$r = Invoke-Api POST '/api/v1/auth/demo-login' ('{"email":"' + $TeamEmail + '"}')
Show "POST /auth/demo-login ($TeamEmail)" $r 200
$team = $null
if ($r.status -eq 200) { $team = Get-Prop $r.json 'access_token' }

$r = Invoke-Api POST '/api/v1/auth/demo-login' ('{"email":"' + $CitizenEmail + '"}')
Show "POST /auth/demo-login ($CitizenEmail)" $r 200
$citizen = $null
if ($r.status -eq 200) { $citizen = Get-Prop $r.json 'access_token' }

if (-not $admin -or -not $team -or -not $citizen) {
    Write-Host 'FATAL: could not obtain demo tokens (is DEMO_MODE=true and the DB seeded?)' -ForegroundColor Red
    exit 1
}

# --- report an incident (citizen) --------------------------------------------
# Two traps here, both hit the hard way:
#
# 1. DUPLICATE GROUPING. The backend files a report under an existing incident
#    when it shares >=50% of its tokens with a same-region, same-category
#    incident younger than 30 minutes. A fixed probe title would be filed under
#    the previous run's incident, and the phase-ladder checks below would then
#    hit the previous incident's phase and 409. Rotating the (region, category)
#    pair makes the dedupe key unique, so the probe always gets its own row.
#
# 2. THE LIVE ASSESSMENT BACKEND. Production runs the LLM backend, not the
#    rules stub. A title made of random hex ("Dispatch probe 7769f2...") was
#    assessed DEFINITELY_FALSE -- correctly -- because it reads as a prank with
#    no hazard in it. The probe therefore files a realistic hazard report.
$ProbePairs = @(
    @{ Region = 'Central Delhi';   Category = 'Flood/Waterlogging';    Text = 'Deep waterlogging on the road near the market, two cars stalled and pedestrians wading.' },
    @{ Region = 'South Delhi';     Category = 'Accident';              Text = 'A car collided with a pole on the main road; the driver is shaken but walking.' },
    @{ Region = 'East Delhi';      Category = 'Utility outage';        Text = 'A transformer has gone down and the whole street has lost power since morning.' },
    @{ Region = 'West Delhi';      Category = 'Fire';                  Text = 'Smoke and flames visible from a building in a residential colony; neighbours are calling the fire brigade.' },
    @{ Region = 'North Delhi';     Category = 'Medical emergency';     Text = 'An elderly man collapsed on the footpath and is not responding; neighbours have called an ambulance.' },
    @{ Region = 'Rohini';          Category = 'Structural collapse';   Text = 'A portion of the balcony of a residential building has collapsed onto the parking area.' },
    @{ Region = 'Dwarka';          Category = 'Accident';              Text = 'A truck has overturned at the intersection and is blocking one side of the road.' },
    @{ Region = 'Yamuna Basin';    Category = 'Flood/Waterlogging';    Text = 'Water has entered homes on the lane after the drain overflowed during the storm.' },
    @{ Region = 'Airport';         Category = 'Utility outage';        Text = 'A large water pipeline has burst near the terminal road and the service road is flooded.' },
    @{ Region = 'Noida';           Category = 'Fire';                  Text = 'A shop on the ground floor is ablaze and the smoke is spreading to the flats above.' },
    @{ Region = 'Gurugram';        Category = 'Accident';              Text = 'A tanker has overturned on the expressway and there is a fuel spill on the road.' },
    @{ Region = 'Ghaziabad';       Category = 'Medical emergency';     Text = 'A motorcyclist has fallen and is bleeding heavily; bystanders are applying pressure.' },
    @{ Region = 'Faridabad';       Category = 'Flood/Waterlogging';    Text = 'A major drain has collapsed and the underpass is submerged with traffic stuck inside.' },
    @{ Region = 'Old Delhi';       Category = 'Fire';                  Text = 'A godown storing cloth has caught fire and dense smoke is rising above the lane.' }
)
$CounterFile = Join-Path $env:TEMP 'astra-module1-counter.txt'
$idx = 0
if (Test-Path $CounterFile) {
    try { $idx = [int]((Get-Content $CounterFile -Raw).Trim()) } catch { $idx = 0 }
}
$idx = $idx % $ProbePairs.Count
Set-Content -Path $CounterFile -Value ($idx + 1) -NoNewline
$pair = $ProbePairs[$idx]
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$fields = @{
    title       = "$($pair.Text) Ref $stamp"
    description = "$($pair.Text) Reported for an automated dispatch-arc verification pass, reference $stamp."
    category    = $pair.Category
    region      = $pair.Region
    latitude    = '28.6139'
    longitude   = '77.2090'
}
$r = Invoke-Multipart '/api/v1/incidents' $fields $citizen
Show 'POST /incidents (citizen report)' $r 201
$incident = Get-Prop $r.json 'id'
Write-Host ("        incident_id = {0}  grouped = {1}  region = {2}" -f $incident, (Get-Prop $r.json 'grouped'), $pair.Region)
if ($r.status -eq 201) {
    if ((Get-Prop $r.json 'grouped') -eq $false) {
        $script:pass++; Write-Host '[PASS] the probe report was NOT duplicate-grouped'
    } else {
        $script:fail++; Write-Host '[FAIL] the probe report was grouped under an existing incident'
    }
}

# --- create a task (admin) ---------------------------------------------------
$r = Invoke-Api POST "/api/v1/tasks/by-incident/$incident" ('{"title":"Probe task","department":"' + $Department + '"}') $admin
Show 'POST /tasks/by-incident/{id} (admin creates task)' $r 201
$task = Get-Prop $r.json 'id'

# --- task status transitions -------------------------------------------------
$r = Invoke-Api PATCH "/api/v1/tasks/$task" '{"status":"IN_PROGRESS"}' $admin
Show 'PATCH /tasks/{id} OPEN -> IN_PROGRESS' $r 200

$r = Invoke-Api PATCH "/api/v1/tasks/$task" '{"status":"DONE"}' $admin
Show 'PATCH /tasks/{id} IN_PROGRESS -> DONE' $r 200

$r = Invoke-Api PATCH "/api/v1/tasks/$task" '{"status":"OPEN"}' $admin
Show 'PATCH /tasks/{id} DONE -> OPEN (backwards -> 409)' $r 409

# --- task updates are append-only --------------------------------------------
$r = Invoke-Api POST "/api/v1/tasks/$task/updates" '{"note":"Team on site","status":"DONE"}' $admin
Show 'POST /tasks/{id}/updates (append-only)' $r 201

$r = Invoke-Api GET "/api/v1/tasks/$task/updates" $null $admin
Show 'GET /tasks/{id}/updates (history readable)' $r 200

# --- RBAC: a response team member cannot create tasks ------------------------
$r = Invoke-Api POST "/api/v1/tasks/by-incident/$incident" '{"title":"Unauthorised task"}' $team
Show 'POST /tasks/by-incident/{id} as response team -> 403' $r 403

# --- phase ladder (strict forward-only) --------------------------------------
$r = Invoke-Api POST "/api/v1/incidents/$incident/phase" '{"phase":"COORDINATING"}' $admin
Show 'POST /incidents/{id}/phase -> COORDINATING' $r 200

$r = Invoke-Api POST "/api/v1/incidents/$incident/phase" '{"phase":"ACTIVE"}' $admin
Show 'POST /incidents/{id}/phase -> ACTIVE' $r 200

$r = Invoke-Api POST "/api/v1/incidents/$incident/phase" '{"phase":"COORDINATING"}' $admin
Show 'POST /incidents/{id}/phase ACTIVE -> COORDINATING (regression -> 409)' $r 409

# --- closure + reopen --------------------------------------------------------
$r = Invoke-Api POST "/api/v1/incidents/$incident/close" '{"note":"Module 1 probe"}' $admin
Show 'POST /incidents/{id}/close (admin, no open tasks)' $r 200

$r = Invoke-Api POST "/api/v1/incidents/$incident/reopen-closed" $null $admin
Show 'POST /incidents/{id}/reopen-closed' $r 200

# --- alerts: geo-targeting + area validation ---------------------------------
$r = Invoke-Api POST '/api/v1/alerts' ('{"event":"flood","title":"Module 1 probe alert","body":"probe","area":"Central Delhi"}') $admin
Show 'POST /alerts with a valid NCR region' $r 201
$probeAlertId = Get-Prop $r.json 'id'

$r = Invoke-Api POST '/api/v1/alerts' ('{"event":"flood","title":"bad area","body":"probe","area":"Atlantis"}') $admin
Show 'POST /alerts with an unknown area -> 422' $r 422

# The seeded demo citizen is subscribed to 8 NCR regions (incl. Central Delhi),
# so they must receive the probe alert. This is the geo-targeting fix: before
# it, `user.department` was compared against `Alert.area` and never matched.
$r = Invoke-Api GET '/api/v1/alerts' $null $citizen
Show 'GET /alerts as the subscribed citizen' $r 200
if ($r.status -eq 200 -and $r.json -and $probeAlertId) {
    if ($r.json -match [regex]::Escape($probeAlertId)) {
        $script:pass++; Write-Host '[PASS] citizen receives the alert for a region they subscribed to'
    } else {
        $script:fail++; Write-Host '[FAIL] citizen did NOT receive the alert for their subscribed region'
    }
}

# Central command publishes the alerts, so it must see every one of them.
$r = Invoke-Api GET '/api/v1/alerts' $null $admin
Show 'GET /alerts as central admin' $r 200
if ($r.status -eq 200 -and $r.json -and $probeAlertId) {
    if ($r.json -match [regex]::Escape($probeAlertId)) {
        $script:pass++; Write-Host '[PASS] central admin sees the alert it just published'
    } else {
        $script:fail++; Write-Host '[FAIL] central admin CANNOT see the alert it published'
    }
}

# --- stats -------------------------------------------------------------------
$r = Invoke-Api GET '/api/v1/stats/overview' $null $admin
Show 'GET /stats/overview' $r 200

# --- P1 security: the endpoints that were public before ----------------------
$r = Invoke-Api GET '/api/v1/weather/current'
Show 'GET /weather/current without a token -> 401' $r 401

$r = Invoke-Api GET '/api/v1/geocode/search?q=Delhi'
Show 'GET /geocode/search without a token -> 401' $r 401

$r = Invoke-Api POST '/api/v1/voice/tts' '{"text":""}' $admin
Show 'POST /voice/tts with empty text -> 422' $r 422

$r = Invoke-Api GET '/api/v1/incidents'
Show 'GET /incidents without a token -> 401' $r 401

Write-Host ''
Write-Host ("=== RESULT: {0} passed, {1} failed ===" -f $script:pass, $script:fail) -ForegroundColor $(if ($script:fail -eq 0) {'Green'} else {'Red'})
exit $script:fail
