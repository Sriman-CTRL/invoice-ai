# One-time database setup for Paivo.
# Creates (or fixes) the `invoice_admin` role and the `invoice_ai` database on
# your local PostgreSQL (default port 5432). Run from the `backend` folder:
#
#     powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
#   or, without prompting:
#     powershell -ExecutionPolicy Bypass -File .\setup-db.ps1 -PostgresPassword "YOUR_POSTGRES_PASSWORD"
#
# You'll be prompted for the `postgres` superuser password unless you pass it.

param([string]$PostgresPassword)

$ErrorActionPreference = "Stop"

$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $Psql)) {
    Write-Host "psql not found at $Psql. Adjust the `$Psql path." -ForegroundColor Red
    exit 1
}

if (-not $PostgresPassword) {
    $secure = Read-Host "Enter the `"postgres`" superuser password" -AsSecureString
    $PostgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$env:PGPASSWORD = $PostgresPassword

# 1. Ensure the role exists with the password your .env expects, and give it
#    CREATEDB so Prisma can create the database if it ever needs to.
$roleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'invoice_admin') THEN
    CREATE ROLE invoice_admin LOGIN CREATEDB PASSWORD 'invoice_dev_password';
  ELSE
    ALTER ROLE invoice_admin WITH LOGIN CREATEDB PASSWORD 'invoice_dev_password';
  END IF;
END
`$`$;
"@

& $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c $roleSql
if ($LASTEXITCODE -ne 0) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue; exit $LASTEXITCODE }
Write-Host "Role 'invoice_admin' is ready." -ForegroundColor Green

# 2. Create the database if it does not exist. We query first (no \gexec, which
#    psql cannot run through -c), then create only when missing.
$exists = & $Psql -U postgres -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'invoice_ai'"
if ($LASTEXITCODE -ne 0) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue; exit $LASTEXITCODE }

if ([string]::IsNullOrWhiteSpace($exists)) {
    & $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE invoice_ai OWNER invoice_admin"
    if ($LASTEXITCODE -ne 0) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue; exit $LASTEXITCODE }
    Write-Host "Database 'invoice_ai' created." -ForegroundColor Green
} else {
    Write-Host "Database 'invoice_ai' already exists." -ForegroundColor Green
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "`nDone. Next:  npx prisma db push   then   npm run seed" -ForegroundColor Cyan
