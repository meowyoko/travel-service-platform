$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$stdout = Join-Path $root "admin-dev.out.log"
$stderr = Join-Path $root "admin-dev.err.log"
$pnpm = (Get-Command pnpm.cmd).Source

Set-Location -LiteralPath $root
& $pnpm --filter "@travel/admin" dev --host "127.0.0.1" 1>> $stdout 2>> $stderr
