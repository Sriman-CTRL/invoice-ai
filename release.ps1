<#
.SYNOPSIS
  Release Paivo to production from a clean build of origin/main. Run by the owner, never by Claude Code.

.DESCRIPTION
  1. Fetches origin and builds origin/main in a fresh temp worktree (never your working folder).
  2. With -Migrate: asks for the Neon OWNER URL (hidden input) and runs backend/scripts/enable-rls.cjs.
  3. Records the current production deployment (for rollback), deploys with --skip-domain and probes it.
  4. Asks before promoting to paivo.in, then checks the live site and rolls back on failure.

  Add -Migrate when backend/scripts/enable-rls.cjs changed since the last release (new tables or columns).
  Add -DryRun to test: builds locally but only PRINTS every vercel and database command.

.EXAMPLE
  .\release.ps1 -DryRun
  .\release.ps1
  .\release.ps1 -Migrate
#>
[CmdletBinding()]
param(
  [switch]$Migrate,
  [switch]$DryRun
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$script:RepoRoot = $PSScriptRoot
$script:LogFile = $null
$script:SecretValues = @()
$script:Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:ExitCode = 0

# ---------------------------------------------------------------- logging (never prints secrets)

function Remove-Secrets {
  param([string]$Text)
  if ($null -eq $Text) { return '' }
  $out = $Text
  foreach ($s in $script:SecretValues) {
    if ($s -and $s.Length -ge 6) { $out = $out.Replace($s, '***') }
  }
  # Any connection string, whoever printed it.
  $out = [regex]::Replace($out, 'postgres(?:ql)?://\S+', 'postgres://***')
  return $out
}

function Write-Log {
  param([string]$Message, [string]$Color = 'Gray')
  $clean = Remove-Secrets $Message
  Write-Host $clean -ForegroundColor $Color
  if ($script:LogFile) {
    Add-Content -Path $script:LogFile -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $clean) -Encoding UTF8
  }
}

function Write-Step { param([string]$Message) Write-Log ''; Write-Log ("== " + $Message) 'Cyan' }
function Write-Ok { param([string]$Message) Write-Log ("   OK   " + $Message) 'Green' }
function Write-Warn { param([string]$Message) Write-Log ("   WARN " + $Message) 'Yellow' }

function Stop-Release {
  param([string]$Message)
  Write-Log ("   STOP " + $Message) 'Red'
  throw $Message
}

# ---------------------------------------------------------------- running native commands

# Runs an executable and returns @{ ExitCode; Out; Err }. Kind is 'local', 'vercel' or 'db'.
# With -DryRun only 'local' commands really run; vercel and db commands are printed.
function Invoke-Native {
  param(
    [Parameter(Mandatory)][string]$Exe,
    [string[]]$Arguments = @(),
    [string]$WorkDir = $script:RepoRoot,
    [ValidateSet('local', 'vercel', 'db')][string]$Kind = 'local',
    [switch]$AllowFail
  )
  $shown = $Exe + ' ' + ($Arguments -join ' ')
  if ($DryRun -and $Kind -ne 'local') {
    Write-Log ("   [dry-run] would run ($Kind): $shown") 'Magenta'
    return @{ ExitCode = 0; Out = ''; Err = ''; Skipped = $true }
  }
  Write-Log ("   > $shown") 'DarkGray'
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'   # native stderr must not throw in Windows PowerShell 5.1
  Push-Location $WorkDir
  try {
    # 2>&1 turns stderr lines into ErrorRecord objects; split them back into stdout and stderr text.
    $all = @(& $Exe @Arguments 2>&1)
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
    $ErrorActionPreference = $old
  }
  $outLines = @()
  $errLines = @()
  foreach ($item in $all) {
    if ($item -is [System.Management.Automation.ErrorRecord]) { $errLines += $item.ToString() } else { $outLines += [string]$item }
  }
  $err = ($errLines -join "`n")
  $outText = ($outLines -join "`n")
  foreach ($line in (($outText + "`n" + $err) -split "`r?`n")) {
    if ($line.Trim()) { Add-Content -Path $script:LogFile -Value ('        ' + (Remove-Secrets $line)) -Encoding UTF8 }
  }
  if ($code -ne 0 -and -not $AllowFail) {
    $tail = (($outText + "`n" + $err) -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 15) -join "`n"
    Write-Log (Remove-Secrets $tail) 'Red'
    Stop-Release "Command failed (exit $code): $shown"
  }
  return @{ ExitCode = $code; Out = $outText; Err = $err; Skipped = $false }
}

# ---------------------------------------------------------------- checks

# The Neon OWNER url: must be a neon.tech host and must not be the restricted app_user role.
function Test-OwnerUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return 'The URL is empty.' }
  $m = [regex]::Match($Url.Trim(), '^postgres(?:ql)?://([^:@/\s]+)(?::[^@\s]*)?@([^/:\s?]+)')
  if (-not $m.Success) { return 'That does not look like a postgres:// connection string.' }
  $user = [uri]::UnescapeDataString($m.Groups[1].Value)
  $hostName = $m.Groups[2].Value.ToLowerInvariant()
  if ($hostName -notmatch '(^|\.)neon\.tech$') { return 'The host is not a neon.tech host. Refusing: this is for the Neon production database only.' }
  if ($user -ieq 'app_user') { return 'That is the restricted app_user URL. enable-rls.cjs needs the OWNER URL.' }
  if ($Url -match '(?i)[?&]options=.*app_user') { return 'The URL mentions app_user. Use the OWNER URL.' }
  return $null
}

# Returns the HTTP status (0 when the host cannot be reached) and the body for a request.
function Get-HttpResult {
  param([string]$Url, [string]$Method = 'GET', [string]$Body = $null)
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
  try {
    $p = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 30 }
    if ($Body) { $p.Body = $Body; $p.ContentType = 'application/json' }
    $r = Invoke-WebRequest @p
    return @{ Status = [int]$r.StatusCode; Body = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $text = ''
      try { $sr = New-Object IO.StreamReader($resp.GetResponseStream()); $text = $sr.ReadToEnd(); $sr.Close() } catch { }
      return @{ Status = [int]$resp.StatusCode; Body = $text }
    }
    return @{ Status = 0; Body = $_.Exception.Message }
  }
}

function Test-JsonBody {
  param([string]$Text)
  try { $null = $Text | ConvertFrom-Json; return $true } catch { return $false }
}

# `vercel curl <path> --deployment <url> -- <curl flags>`; returns status code and body.
function Invoke-DeploymentCurl {
  param([string]$DeploymentUrl, [string]$Path, [string]$Method = 'GET', [string]$BodyJson = $null)
  $extra = @('--silent', '--show-error', '--max-time', '40', '--write-out', '|||%{http_code}')
  $tmp = $null
  if ($Method -ne 'GET') {
    $tmp = Join-Path $env:TEMP ("paivo-release-body-{0}.json" -f [guid]::NewGuid().ToString('N'))
    [IO.File]::WriteAllText($tmp, $BodyJson, (New-Object Text.UTF8Encoding($false)))
    $extra += @('--request', $Method, '--header', 'Content-Type: application/json', '--data-binary', ('@' + $tmp))
  }
  try {
    $args2 = @('curl', $Path, '--deployment', $DeploymentUrl, '--') + $extra
    $r = Invoke-Native -Exe 'vercel' -Arguments $args2 -Kind 'vercel' -WorkDir $script:Worktree -AllowFail
  } finally {
    if ($tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
  if ($r.Skipped) { return @{ Status = -1; Body = '' } }
  # curl prints the body and then |||<status>. Read stdout first, then stderr in case the CLI forwards it there.
  foreach ($text in @($r.Out, ($r.Out + "`n" + $r.Err))) {
    $all = [regex]::Matches($text, '\|\|\|(\d{3})')
    if ($all.Count -gt 0) {
      $last = $all[$all.Count - 1]
      return @{ Status = [int]$last.Groups[1].Value; Body = $text.Substring(0, $last.Index) }
    }
  }
  return @{ Status = 0; Body = ($r.Out + ' ' + $r.Err) }
}

function New-RandomLoginBody {
  $e = 'release-check-' + [guid]::NewGuid().ToString('N') + '@example.com'
  $pw = 'Nope-' + [guid]::NewGuid().ToString('N')
  return ('{"email":"' + $e + '","password":"' + $pw + '"}')
}

# ---------------------------------------------------------------- main

function Invoke-Release {
  $logDir = Join-Path $script:RepoRoot 'release-logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $script:LogFile = Join-Path $logDir ("release-{0}.log" -f $script:Stamp)
  New-Item -ItemType File -Force -Path $script:LogFile | Out-Null
  try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

  $script:Worktree = $null
  $ownerUrl = $null
  try {
    Write-Log ("Paivo release  {0}   Migrate={1}  DryRun={2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), [bool]$Migrate, [bool]$DryRun) 'White'
    Write-Log ("Log file: " + $script:LogFile)

    # ------------------------------------------------ 0. tools
    Write-Step 'Check tools'
    $need = @('git', 'node', 'npm', 'npx')
    if (-not $DryRun) { $need += 'vercel' }
    foreach ($t in $need) {
      if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { Stop-Release "'$t' was not found on PATH." }
    }
    if ($DryRun -and -not (Get-Command vercel -ErrorAction SilentlyContinue)) { Write-Warn "vercel not on PATH (fine for -DryRun)." }
    Write-Ok ('tools: ' + ($need -join ', '))

    # ------------------------------------------------ 1. fetch + worktree
    Write-Step 'Fetch origin and create a clean worktree of origin/main'
    Invoke-Native -Exe 'git' -Arguments @('fetch', 'origin', '--prune') | Out-Null
    $sha = (Invoke-Native -Exe 'git' -Arguments @('rev-parse', 'origin/main')).Out.Trim()
    $subject = (Invoke-Native -Exe 'git' -Arguments @('log', '-1', '--format=%s', 'origin/main')).Out.Trim()
    Write-Ok ("origin/main = " + $sha.Substring(0, 8) + "  " + $subject)
    $script:Worktree = Join-Path $env:TEMP ("paivo-release-{0}" -f $script:Stamp)
    Invoke-Native -Exe 'git' -Arguments @('worktree', 'add', '--detach', $script:Worktree, 'origin/main') | Out-Null
    Write-Ok ("worktree: " + $script:Worktree)

    # The Vercel project link is git-ignored, so copy it from the repo. Never copy .env files.
    $link = Join-Path $script:RepoRoot '.vercel'
    if (Test-Path (Join-Path $link 'project.json')) {
      New-Item -ItemType Directory -Force -Path (Join-Path $script:Worktree '.vercel') | Out-Null
      Copy-Item (Join-Path $link 'project.json') (Join-Path $script:Worktree '.vercel\project.json') -Force
      Write-Ok 'copied .vercel/project.json (project link)'
    } elseif ($DryRun) {
      Write-Warn 'no .vercel/project.json in the repo folder (a real release needs it: run "vercel link" once here)'
    } else {
      Stop-Release 'No .vercel/project.json in the repo folder. Run "vercel link" once in your repo folder, then retry.'
    }

    # ------------------------------------------------ 2. build
    Write-Step 'Build (npm ci root + backend, prisma generate, npm run build)'
    $backend = Join-Path $script:Worktree 'backend'
    Invoke-Native -Exe 'npm' -Arguments @('ci') -WorkDir $script:Worktree | Out-Null
    Write-Ok 'npm ci (root)'
    Invoke-Native -Exe 'npm' -Arguments @('ci') -WorkDir $backend | Out-Null
    Write-Ok 'npm ci (backend)'
    Invoke-Native -Exe 'npx' -Arguments @('prisma', 'generate') -WorkDir $backend | Out-Null
    Write-Ok 'prisma generate'
    Invoke-Native -Exe 'npm' -Arguments @('run', 'build') -WorkDir $script:Worktree | Out-Null
    $api = Join-Path $script:Worktree 'api\index.js'
    if (-not (Test-Path $api)) { Stop-Release 'Build finished but api/index.js does not exist. Deploying now would publish the site with NO API.' }
    $apiMb = [math]::Round((Get-Item $api).Length / 1MB, 2)
    Write-Ok ("build done, api/index.js = $apiMb MB")
    if ($apiMb -lt 3.5) { Write-Warn "api/index.js is $apiMb MB; AGENTS.md says about 4.5 MB (2.5-2.7 MB means a pre-Sentry or incomplete build). Check before promoting." }

    # ------------------------------------------------ 3. migrate (optional)
    if ($Migrate) {
      Write-Step 'Database: run enable-rls.cjs with the Neon OWNER url'
      if ($DryRun) {
        Write-Log '   [dry-run] would ask for the Neon OWNER url (hidden), refuse anything that is not neon.tech or is app_user,' 'Magenta'
        Write-Log '   [dry-run] then run: node scripts/enable-rls.cjs   (cwd: worktree\backend) and require "RLS enabled on" in the output' 'Magenta'
      } else {
        $secure = Read-Host -AsSecureString 'Paste the Neon OWNER connection URL (input is hidden)'
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $ownerUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        $problem = Test-OwnerUrl $ownerUrl
        if ($problem) { $ownerUrl = $null; Stop-Release $problem }
        $script:SecretValues += $ownerUrl
        $pw = [regex]::Match($ownerUrl, '^postgres(?:ql)?://[^:@/]+:([^@]+)@').Groups[1].Value
        if ($pw) { $script:SecretValues += $pw }
        $env:DATABASE_URL = $ownerUrl
        $oldApp = $env:DATABASE_URL_APP
        $env:DATABASE_URL_APP = $null
        try {
          $r = Invoke-Native -Exe 'node' -Arguments @('scripts/enable-rls.cjs') -WorkDir $backend -Kind 'db'
        } finally {
          $env:DATABASE_URL = $null
          $env:DATABASE_URL_APP = $oldApp
          $ownerUrl = $null
          $script:SecretValues = @()
          [GC]::Collect()
        }
        if (($r.Out + $r.Err) -notmatch 'RLS enabled on') { Stop-Release 'enable-rls.cjs did not report "RLS enabled on". Not deploying.' }
        Write-Ok 'enable-rls.cjs finished: RLS enabled on ...'
      }
    } else {
      Write-Log 'Skipping the database step (no -Migrate). Add -Migrate if backend/scripts/enable-rls.cjs changed.' 'DarkGray'
    }

    # ------------------------------------------------ 4. previous production deployment
    Write-Step 'Record the current production deployment (for rollback)'
    $prevUrl = $null
    if ($DryRun) {
      Invoke-Native -Exe 'vercel' -Arguments @('inspect', 'https://paivo.in') -Kind 'vercel' -WorkDir $script:Worktree | Out-Null
      $prevUrl = 'https://previous-production.example.vercel.app'
    } else {
      $ins = Invoke-Native -Exe 'vercel' -Arguments @('inspect', 'https://paivo.in') -Kind 'vercel' -WorkDir $script:Worktree -AllowFail
      $mm = [regex]::Match(($ins.Out + "`n" + $ins.Err), '(?m)^\s*url\s+(https://[A-Za-z0-9.-]+\.vercel\.app)')
      if (-not $mm.Success) { $mm = [regex]::Match(($ins.Out + "`n" + $ins.Err), 'Fetched deployment "([A-Za-z0-9.-]+\.vercel\.app)"') }
      if ($mm.Success) {
        $prevUrl = $mm.Groups[1].Value
        if ($prevUrl -notmatch '^https://') { $prevUrl = 'https://' + $prevUrl }
      } else {
        Write-Warn 'Could not read the current production deployment from "vercel inspect".'
        $prevUrl = (Read-Host 'Paste the CURRENT production deployment URL (https://...vercel.app), or press Enter to abort').Trim()
        if (-not $prevUrl) { Stop-Release 'No rollback target. Nothing was deployed.' }
      }
    }
    Write-Ok ("rollback target: " + $prevUrl)

    # ------------------------------------------------ 5. deploy (not promoted)
    Write-Step 'Deploy to production without touching paivo.in (--skip-domain)'
    $newUrl = $null
    if ($DryRun) {
      Invoke-Native -Exe 'vercel' -Arguments @('deploy', '--prod', '--skip-domain') -Kind 'vercel' -WorkDir $script:Worktree | Out-Null
      $newUrl = 'https://new-deployment.example.vercel.app'
    } else {
      $d = Invoke-Native -Exe 'vercel' -Arguments @('deploy', '--prod', '--skip-domain') -Kind 'vercel' -WorkDir $script:Worktree
      # The CLI prints the deployment URL on stdout; fall back to the progress text on stderr.
      $urls = [regex]::Matches($d.Out, 'https://[A-Za-z0-9.-]+\.vercel\.app')
      if ($urls.Count -eq 0) { $urls = [regex]::Matches($d.Err, 'https://[A-Za-z0-9.-]+\.vercel\.app') }
      if ($urls.Count -eq 0) { Stop-Release 'Deploy finished but no deployment URL was found in the output.' }
      $newUrl = $urls[$urls.Count - 1].Value
    }
    Write-Ok ("new deployment: " + $newUrl)

    # ------------------------------------------------ 6. inspect + probes
    Write-Step 'Check the new deployment before it is promoted'
    $lambda = [string][char]0x03BB
    if ($DryRun) {
      Invoke-Native -Exe 'vercel' -Arguments @('inspect', $newUrl) -Kind 'vercel' -WorkDir $script:Worktree | Out-Null
      Write-Log ("   [dry-run] would require the build list to contain '$lambda api/index'") 'Magenta'
    } else {
      $ins2 = Invoke-Native -Exe 'vercel' -Arguments @('inspect', $newUrl) -Kind 'vercel' -WorkDir $script:Worktree
      $text = $ins2.Out + "`n" + $ins2.Err
      # The lambda glyph can be garbled by the console code page, so accept any single symbol before "api/index".
      if ($text -notmatch ('(?m)^\s*(?:' + [regex]::Escape($lambda) + '|\S)\s+api/index\b')) {
        Stop-Release "vercel inspect does not list '$lambda api/index'. The deployment has no API. Nothing promoted."
      }
      Write-Ok "vercel inspect lists api/index"
      $sz = [regex]::Match($text, 'api/index\s*\(([\d.]+)\s*(MB|kB|KB)\)')
      if ($sz.Success) { Write-Log ("   function size: " + $sz.Groups[1].Value + ' ' + $sz.Groups[2].Value) 'DarkGray' }
    }

    $h = Invoke-DeploymentCurl -DeploymentUrl $newUrl -Path '/health'
    if ($DryRun) { Write-Log '   [dry-run] would require /health = 200 with database connected' 'Magenta' }
    else {
      if ($h.Status -ne 200 -or $h.Body -notmatch '"database"\s*:\s*"connected"') { Stop-Release ("/health on the new deployment: status " + $h.Status + " body: " + $h.Body) }
      Write-Ok '/health 200, database connected'
    }

    $l = Invoke-DeploymentCurl -DeploymentUrl $newUrl -Path '/api/auth/login' -Method 'POST' -BodyJson (New-RandomLoginBody)
    if ($DryRun) { Write-Log '   [dry-run] would require a random login = 401' 'Magenta' }
    else {
      if ($l.Status -ne 401) { Stop-Release ("random login on the new deployment: expected 401, got " + $l.Status) }
      Write-Ok 'random login -> 401'
    }

    $uuid = [guid]::NewGuid().ToString()
    $p = Invoke-DeploymentCurl -DeploymentUrl $newUrl -Path ("/api/public/invoices/" + $uuid)
    if ($DryRun) { Write-Log '   [dry-run] would require a random public invoice = JSON 404' 'Magenta' }
    else {
      if ($p.Status -ne 404 -or -not (Test-JsonBody $p.Body)) { Stop-Release ("random public invoice on the new deployment: expected JSON 404, got " + $p.Status + " " + $p.Body.Substring(0, [math]::Min(80, $p.Body.Length))) }
      Write-Ok 'random public invoice -> JSON 404'
    }

    # ------------------------------------------------ 7. promote?
    Write-Step 'Promote'
    if ($DryRun) {
      Write-Log "   [dry-run] would ask 'Promote to paivo.in? (y/N)' and on y run: vercel promote $newUrl --yes" 'Magenta'
      Write-Log '   [dry-run] then check https://paivo.in: /health 200, random login 401, /og.png 200; on failure: vercel rollback <previous> --yes' 'Magenta'
      Write-Ok 'dry run finished'
      return
    }
    Write-Log ("   New deployment: " + $newUrl)
    Write-Log ("   Previous (rollback target): " + $prevUrl)
    $answer = Read-Host 'Promote to paivo.in? (y/N)'
    if ($answer -notmatch '^(y|yes)$') {
      Write-Warn 'Not promoted. paivo.in is unchanged. The new deployment stays available at the URL above.'
      return
    }
    Invoke-Native -Exe 'vercel' -Arguments @('promote', $newUrl, '--yes') -Kind 'vercel' -WorkDir $script:Worktree | Out-Null
    Write-Ok 'promoted'

    # ------------------------------------------------ 8. live checks (retry a little: promotion takes a moment)
    Write-Step 'Live checks on https://paivo.in'
    $live = $true
    $checks = @(
      @{ Name = '/health 200, database connected'; Run = { $r = Get-HttpResult 'https://paivo.in/health'; ($r.Status -eq 200 -and $r.Body -match '"database"\s*:\s*"connected"') } },
      @{ Name = 'random login 401'; Run = { $r = Get-HttpResult 'https://paivo.in/api/auth/login' 'POST' (New-RandomLoginBody); ($r.Status -eq 401) } },
      @{ Name = '/og.png 200'; Run = { $r = Get-HttpResult 'https://paivo.in/og.png'; ($r.Status -eq 200) } }
    )
    foreach ($c in $checks) {
      $passed = $false
      for ($i = 1; $i -le 5 -and -not $passed; $i++) {
        $passed = [bool](& $c.Run)
        if (-not $passed) { Start-Sleep -Seconds 4 }
      }
      if ($passed) { Write-Ok $c.Name } else { $live = $false; Write-Log ("   FAIL " + $c.Name) 'Red' }
    }
    if (-not $live) {
      Write-Log 'A live check failed. Rolling back.' 'Red'
      Invoke-Native -Exe 'vercel' -Arguments @('rollback', $prevUrl, '--yes') -Kind 'vercel' -WorkDir $script:Worktree -AllowFail | Out-Null
      Start-Sleep -Seconds 6
      $after = Get-HttpResult 'https://paivo.in/health'
      if ($after.Status -eq 200) { Write-Log ("Rollback done: https://paivo.in/health is 200 again (back on " + $prevUrl + ").") 'Yellow' }
      else { Write-Log ("ROLLBACK DID NOT RESTORE THE SITE: /health is " + $after.Status + ". Run: vercel rollback " + $prevUrl + " --yes  and check the Vercel dashboard NOW.") 'Red' }
      $script:ExitCode = 2
      return
    }
    Write-Log ''
    Write-Log ("Released " + $sha.Substring(0, 8) + " to https://paivo.in") 'Green'
    Write-Log ("If anything looks wrong later: vercel rollback " + $prevUrl + " --yes") 'Gray'
  } catch {
    Write-Log ("Release stopped: " + $_.Exception.Message) 'Red'
    $script:ExitCode = 1
  } finally {
    # Always leave no secret and no worktree behind.
    $env:DATABASE_URL = $null
    $ownerUrl = $null
    $script:SecretValues = @()
    if ($script:Worktree) {
      Push-Location $script:RepoRoot
      try {
        # rmdir is far faster than git or Remove-Item for two node_modules folders.
        foreach ($nm in @((Join-Path $script:Worktree 'node_modules'), (Join-Path $script:Worktree 'backend
ode_modules'))) {
          if (Test-Path $nm) { & cmd.exe /d /c ('rmdir /s /q "' + $nm + '"') 2>$null | Out-Null }
        }
        $old = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & git worktree remove --force $script:Worktree 2>$null | Out-Null
        & git worktree prune 2>$null | Out-Null
        $ErrorActionPreference = $old
      } catch { }
      Pop-Location
      if (Test-Path $script:Worktree) { Remove-Item -Recurse -Force $script:Worktree -ErrorAction SilentlyContinue }
      if (Test-Path $script:Worktree) { Write-Warn ("Could not delete " + $script:Worktree + "; delete it by hand.") } else { Write-Log '   worktree removed' 'DarkGray' }
    }
    Write-Log ("Log: " + $script:LogFile) 'DarkGray'
  }
}

# Dot-sourcing (". .\release.ps1") only loads the functions, so they can be tested without releasing.
if ($MyInvocation.InvocationName -ne '.') {
  Invoke-Release
  if ($script:ExitCode -ne 0) { exit $script:ExitCode }
}
