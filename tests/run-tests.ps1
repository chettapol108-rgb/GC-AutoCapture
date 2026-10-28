$ErrorActionPreference = 'Stop'
& cscript.exe //nologo //E:JScript (Join-Path $PSScriptRoot 'export.test.js')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
