$sourceDir = "C:\Users\gpuuser\Documents\event_v1"
$zipFile = "C:\Users\gpuuser\Documents\event_v1_release.zip"

if (Test-Path $zipFile) {
    Remove-Item -Path $zipFile -Force
}

$excludeList = @("node_modules", ".next", ".git", "*.zip")

$itemsToZip = Get-ChildItem -Path $sourceDir | Where-Object {
    $item = $_
    $skip = $false
    foreach ($ex in $excludeList) {
        if ($item.Name -like $ex) {
            $skip = $true
            break
        }
    }
    -not $skip
}

Write-Host "Compressing $($itemsToZip.Count) items into $zipFile..."

Compress-Archive -Path ($itemsToZip.FullName) -DestinationPath $zipFile -CompressionLevel Optimal

if (Test-Path $zipFile) {
    $fi = Get-Item $zipFile
    $sizeMB = [math]::Round($fi.Length / 1MB, 2)
    Write-Host "SUCCESS: Archive created at $zipFile ($sizeMB MB)"
} else {
    Write-Error "Failed to generate zip file."
}
