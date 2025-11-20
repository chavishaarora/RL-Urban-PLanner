# Import Path Update Script
# This script helps update import paths to use the new @ alias

Set-Location -Path "frontend\src"

Write-Host "Scanning for files with old import paths..." -ForegroundColor Cyan

$files = Get-ChildItem -Path . -Recurse -Include *.ts,*.tsx -File

$totalFiles = $files.Count
$updatedFiles = 0

Write-Host "Found $totalFiles files to check" -ForegroundColor Yellow

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    
    # Update relative imports to use @ alias
    $patterns = @(
        @{Old='from [''"]\.\.\/\.\./\.\.\/components/'; New='from ''@/components/'},
        @{Old='from [''"]\.\.\/\.\./components/'; New='from ''@/components/'},
        @{Old='from [''"]\.\.\/components/'; New='from ''@/components/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/contexts/'; New='from ''@/contexts/'},
        @{Old='from [''"]\.\.\/\.\./contexts/'; New='from ''@/contexts/'},
        @{Old='from [''"]\.\.\/contexts/'; New='from ''@/contexts/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/services/'; New='from ''@/services/'},
        @{Old='from [''"]\.\.\/\.\./services/'; New='from ''@/services/'},
        @{Old='from [''"]\.\.\/services/'; New='from ''@/services/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/utils/'; New='from ''@/utils/'},
        @{Old='from [''"]\.\.\/\.\./utils/'; New='from ''@/utils/'},
        @{Old='from [''"]\.\.\/utils/'; New='from ''@/utils/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/hooks/'; New='from ''@/hooks/'},
        @{Old='from [''"]\.\.\/\.\./hooks/'; New='from ''@/hooks/'},
        @{Old='from [''"]\.\.\/hooks/'; New='from ''@/hooks/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/types/'; New='from ''@/types/'},
        @{Old='from [''"]\.\.\/\.\./types/'; New='from ''@/types/'},
        @{Old='from [''"]\.\.\/types/'; New='from ''@/types/'},
        @{Old='from [''"]\.\.\/\.\./\.\.\/data/'; New='from ''@/data/'},
        @{Old='from [''"]\.\.\/\.\./data/'; New='from ''@/data/'},
        @{Old='from [''"]\.\.\/data/'; New='from ''@/data/'}
    )
    
    foreach ($pattern in $patterns) {
        $content = $content -replace $pattern.Old, $pattern.New
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updatedFiles++
        Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "Total files scanned: $totalFiles" -ForegroundColor White
Write-Host "Files updated: $updatedFiles" -ForegroundColor Green

if ($updatedFiles -gt 0) {
    Write-Host "`nImport paths updated successfully!" -ForegroundColor Green
} else {
    Write-Host "`nAll import paths already use @ alias!" -ForegroundColor Green
}

Set-Location -Path "..\..\"

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Review changes" -ForegroundColor White
Write-Host "2. Run: cd frontend && npm install" -ForegroundColor White
Write-Host "3. Test: npm run dev" -ForegroundColor White
