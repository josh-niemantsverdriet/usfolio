param([Parameter(Mandatory=$true)][string]$Server)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$migration = [IO.File]::ReadAllText((Join-Path $repo 'api/migrations/001_initial.sql')).Replace('dbo.', 'UsfolioMigrationVerify.')
$start = @'
SET XACT_ABORT ON;
BEGIN TRANSACTION;
EXEC('CREATE SCHEMA UsfolioMigrationVerify');
'@
$finish = @'
INSERT UsfolioMigrationVerify.Profiles(id,payload)
VALUES ('test-profile', N'{"id":"test-profile","subject":"test-subject"}');
IF (SELECT subject FROM UsfolioMigrationVerify.Profiles) <> 'test-subject'
 THROW 50002, 'Computed subject mismatch', 1;
IF (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('UsfolioMigrationVerify')) <> 5
 THROW 50003, 'Expected five tables', 1;
SELECT 'Migration schema and computed indexes verified; all changes rolled back.' AS result;
ROLLBACK TRANSACTION;
'@
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('usfolio-migration-' + [guid]::NewGuid() + '.sql')
try {
 [IO.File]::WriteAllText($scratch, "$start`n$migration`n$finish")
 & sqlcmd -S $Server -E -d tempdb -i $scratch -b
 if ($LASTEXITCODE -ne 0) { throw 'SQL migration verification failed.' }
} finally { Remove-Item -LiteralPath $scratch -ErrorAction SilentlyContinue }
