# Galacticord Windows Configuration Script

param (
    [switch]$ConfigOnly
)

function Configure-Env {
    $envFile = ".env"
    $current = @{}

    if (Test-Path $envFile) {
        Copy-Item $envFile "$envFile.bak" -Force
        Write-Host "Existing .env backed up to .env.bak" -ForegroundColor Cyan
        
        # Simple parser for existing .env
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $current[$matches[1].Trim()] = $matches[2].Trim()
            }
        }
    }

    Write-Host "`n----------------------------------------------------" -ForegroundColor Yellow
    Write-Host "NOTE: If you already have tokens saved in .env, you can press ENTER" -ForegroundColor Yellow
    Write-Host "to leave a field blank and it will NOT modify that specific value." -ForegroundColor Yellow
    Write-Host "If you don't want to provide a certain credential, just press ENTER." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor Yellow

    $token = Read-Host "Discord Bot Token (Current: $($current['DISCORD_TOKEN'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($token)) { $token = $current['DISCORD_TOKEN'] }

    $clientId = Read-Host "Discord Client ID (Current: $($current['CLIENT_ID'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($clientId)) { $clientId = $current['CLIENT_ID'] }

    $geminiKey = Read-Host "Gemini API Key (Current: $($current['GEMINI_API_KEY'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($geminiKey)) { $geminiKey = $current['GEMINI_API_KEY'] }

    $gcloudKey = Read-Host "Google Cloud API Key (Current: $($current['GOOGLE_CLOUD_API_KEY'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($gcloudKey)) { $gcloudKey = $current['GOOGLE_CLOUD_API_KEY'] }

    $ytKey = Read-Host "YouTube API Key (Current: $($current['YOUTUBE_API_KEY'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($ytKey)) { $ytKey = $current['YOUTUBE_API_KEY'] }

    $ownerId = Read-Host "Bot Owner ID (Current: $($current['OWNER_ID'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($ownerId)) { $ownerId = $current['OWNER_ID'] }

    $awsRegion = Read-Host "AWS Region for Polly (Current: $($current['AWS_REGION'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($awsRegion)) { $awsRegion = $current['AWS_REGION'] }

    $awsAccess = Read-Host "AWS Access Key ID (Current: $($current['AWS_ACCESS_KEY_ID'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($awsAccess)) { $awsAccess = $current['AWS_ACCESS_KEY_ID'] }

    $awsSecret = Read-Host "AWS Secret Access Key (Current: $($current['AWS_SECRET_ACCESS_KEY'] ?? 'None'))"
    if ([string]::IsNullOrWhiteSpace($awsSecret)) { $awsSecret = $current['AWS_SECRET_ACCESS_KEY'] }

    $content = @(
        "DISCORD_TOKEN=$token",
        "CLIENT_ID=$clientId",
        "GEMINI_API_KEY=$geminiKey",
        "GOOGLE_CLOUD_API_KEY=$gcloudKey",
        "YOUTUBE_API_KEY=$ytKey",
        "OWNER_ID=$ownerId",
        "AWS_REGION=$awsRegion",
        "AWS_ACCESS_KEY_ID=$awsAccess",
        "AWS_SECRET_ACCESS_KEY=$awsSecret"
    )

    $content | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
    # Fix newline issues common with Out-File
    (Get-Content $envFile) -join "`n" | Set-Content $envFile
    
    Write-Host "`n.env file updated successfully!" -ForegroundColor Green
}

if ($ConfigOnly) {
    Configure-Env
} else {
    Write-Host "This script is usually called by setup.bat"
    Configure-Env
}
