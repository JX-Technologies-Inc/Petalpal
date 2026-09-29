# Use the current production SkSL and checked-in calibration, not stale GDI offsets.
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'preview-water-top.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Water-top Skia preview failed.' }
