param([string]$StagedFile)

$ErrorActionPreference = 'Stop'
$script:ResultFile = $null

function Write-Result([string]$Message) {
    Write-Host $Message
    if ($script:ResultFile) {
        Add-Content -LiteralPath $script:ResultFile -Value $Message -Encoding UTF8
    }
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Script([string]$SourceFile, [string]$StageRoot) {
    $adobe = Join-Path $env:ProgramFiles 'Adobe'
    if (-not (Test-Path -LiteralPath $adobe -PathType Container)) {
        Write-Result "[ERROR] Adobe installation folder not found: $adobe"
        return 1
    }

    $installations = @(Get-ChildItem -LiteralPath $adobe -Directory |
        Where-Object { $_.Name -match '^Adobe Illustrator 20\d{2}$' } |
        Sort-Object Name)
    if ($installations.Count -eq 0) {
        Write-Result "[ERROR] No Adobe Illustrator 20xx installation found under $adobe"
        return 1
    }

    $updated = 0
    $failed = 0
    foreach ($installation in $installations) {
        $preset = Join-Path $installation.FullName 'Presets\en_US'
        if (-not (Test-Path -LiteralPath $preset -PathType Container)) {
            Write-Result "[SKIP] en_US preset not found: $($installation.FullName)"
            $failed++
            continue
        }

        $target = Join-Path $preset 'Scripts'
        $installStage = Join-Path $StageRoot ("Install-" + $installation.Name)
        $desktopCopy = Join-Path $installStage (Split-Path -Leaf $SourceFile)
        try {
            if (-not (Test-Path -LiteralPath $target -PathType Container)) {
                New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
            }
            New-Item -ItemType Directory -Path $installStage -ErrorAction Stop | Out-Null
            Copy-Item -LiteralPath $SourceFile -Destination $desktopCopy -ErrorAction Stop

            # Only remove known AutoCapture names in this Illustrator Scripts folder.
            $oldFiles = @(Get-ChildItem -LiteralPath $target -File | Where-Object {
                $_.Name -match '^(?:GC-AutoCaputre|GC-AutoCapture)(?: v\d+\.\d+\.\d+)?\.js$'
            })
            foreach ($oldFile in $oldFiles) {
                Remove-Item -LiteralPath $oldFile.FullName -Force -ErrorAction Stop
            }

            $destination = Join-Path $target (Split-Path -Leaf $SourceFile)
            Move-Item -LiteralPath $desktopCopy -Destination $destination -ErrorAction Stop
            Remove-Item -LiteralPath $installStage -ErrorAction Stop
            Write-Result "[OK] $destination"
            $updated++
        } catch {
            Write-Result "[ERROR] $($installation.Name): $($_.Exception.Message)"
            if (Test-Path -LiteralPath $desktopCopy -PathType Leaf) {
                Write-Result "[INFO] Desktop copy kept for manual recovery: $desktopCopy"
            }
            $failed++
        }
    }

    Write-Result ''
    Write-Result "Illustrator installations found: $($installations.Count)"
    Write-Result "Updated: $updated"
    Write-Result "Failed or skipped: $failed"
    if ($failed -gt 0) { return 1 }
    return 0
}

try {
    if ($StagedFile) {
        $source = Get-Item -LiteralPath $StagedFile -ErrorAction Stop
        if ($source.Name -notmatch '^GC-AutoCapture v\d+\.\d+\.\d+\.js$') {
            throw "Invalid staged script name: $($source.Name)"
        }
        if (-not (Test-Administrator)) {
            throw 'Administrator permission was not granted.'
        }
        $stageRoot = Split-Path -Parent $source.FullName
        $script:ResultFile = Join-Path $stageRoot 'result.txt'
        exit (Install-Script $source.FullName $stageRoot)
    }

    $candidates = @(Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object {
        $_.Name -match '^GC-AutoCapture v\d+\.\d+\.\d+\.js$'
    })
    if ($candidates.Count -ne 1) {
        throw "Expected exactly one GC-AutoCapture vX.X.X.js beside this updater; found $($candidates.Count)."
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not (Test-Path -LiteralPath $desktop -PathType Container)) {
        throw "Desktop folder not found: $desktop"
    }
    $stageRoot = Join-Path $desktop ('GC-AutoCapture-Update-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stageRoot -ErrorAction Stop | Out-Null
    $source = Join-Path $stageRoot $candidates[0].Name
    Copy-Item -LiteralPath $candidates[0].FullName -Destination $source -ErrorAction Stop
    $script:ResultFile = Join-Path $stageRoot 'result.txt'

    if (Test-Administrator) {
        $result = Install-Script $source $stageRoot
    } else {
        # The elevated process may not see a mapped G: drive, so run its copy from Desktop.
        $elevatedScript = Join-Path $stageRoot 'Update-Illustrator-Script.ps1'
        Copy-Item -LiteralPath $PSCommandPath -Destination $elevatedScript -ErrorAction Stop
        Write-Host 'Requesting Administrator permission to update Illustrator...'
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $elevatedScript + '"'), '-StagedFile', ('"' + $source + '"'))
        $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -Wait -PassThru -ErrorAction Stop
        $result = $process.ExitCode
        if (Test-Path -LiteralPath $script:ResultFile -PathType Leaf) {
            Get-Content -LiteralPath $script:ResultFile -Encoding UTF8 | ForEach-Object { Write-Host $_ }
        }
    }

    if ($result -eq 0) {
        foreach ($file in @($source, $script:ResultFile, (Join-Path $stageRoot 'Update-Illustrator-Script.ps1'))) {
            if (Test-Path -LiteralPath $file -PathType Leaf) {
                Remove-Item -LiteralPath $file -Force
            }
        }
        Remove-Item -LiteralPath $stageRoot
    } else {
        Write-Host "[INFO] Desktop staging folder kept: $stageRoot"
    }
    exit $result
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    if ($stageRoot -and (Test-Path -LiteralPath $stageRoot -PathType Container)) {
        Write-Host "[INFO] Desktop staging folder kept: $stageRoot"
    }
    exit 1
}
