# Build Re-ID + PA-100K gallery from PA-100K images (default: auto-detect .../PA-100K/data).
# Run from repo root or double-click from ml-services folder.
# Requires: Python with torch, torchvision, Pillow, numpy (see requirements.txt).

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host "=== GuardianEye: index PA-100K gallery (OSNet + PA-100K) ===" -ForegroundColor Cyan
Write-Host "Weights: weights\pa100k_last.pth, weights\osnet_x1_0_imagenet.pth" -ForegroundColor Gray

# Quick smoke test (~few minutes on CPU depending on machine)
$max = if ($args.Count -ge 1) { [int]$args[0] } else { 300 }
Write-Host "Indexing up to $max images (pass a number as first arg to change, e.g. .\run_pa100k_index.ps1 5000)" -ForegroundColor Yellow

python scripts/build_gallery_from_datasets.py --max-images $max
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Next: start ML service:  python -m uvicorn main:app --port 8001 --reload" -ForegroundColor Green
Write-Host "  Backend: cd ..\backend && npm run dev" -ForegroundColor Green
Write-Host "  Frontend: cd ..\frontend && npm run dev  → open Re-ID search and upload a query image." -ForegroundColor Green
