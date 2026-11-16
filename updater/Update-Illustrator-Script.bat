@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Run from an elevated Command Prompt. The mapped G: drive must be available there.
set "SOURCE=G:\004 Program\illustrator-Stuff\Auto Capture\GC-AutoCaputre.js"
set "FILE_NAME=GC-AutoCaputre.js"
set /a FOUND=0,UPDATED=0,FAILED=0 >nul
set "RESULT=0"

if /i "%SOURCE:~0,2%"=="G:" if not exist "G:\" (
    echo [ERROR] G: drive is unavailable in this Command Prompt.
    echo Connect the NAS drive here, or set SOURCE to its UNC path.
    set "RESULT=1"
    goto :finish
)
if not exist "%SOURCE%" (
    for %%S in ("%SOURCE%") do if not exist "%%~dpS" (
        echo [ERROR] NAS source folder not found: "%%~dpS"
        echo Check the NAS connection and folder path.
    ) else (
        echo [ERROR] Source file not found: "%SOURCE%"
        echo Check the file name on the NAS.
    )
    set "RESULT=1"
    goto :finish
)

if not exist "%ProgramFiles%\Adobe\" (
    echo [ERROR] Adobe installation folder not found: "%ProgramFiles%\Adobe"
    set "RESULT=1"
    goto :finish
)

for /d %%I in ("%ProgramFiles%\Adobe\Adobe Illustrator 20??") do (
    if exist "%%~fI\" call :update "%%~fI"
)

if %FOUND% EQU 0 (
    echo [ERROR] No Adobe Illustrator 20xx installation found under "%ProgramFiles%\Adobe".
    set "RESULT=1"
    goto :finish
)

echo.
echo Illustrator installations found: %FOUND%
echo Updated: %UPDATED%
echo Failed or skipped: %FAILED%
if %FAILED% GTR 0 set "RESULT=1"
goto :finish

:update
set /a FOUND+=1 >nul
set "TARGET_DIR=%~1\Presets\en_US\Scripts"
if not exist "%~1\Presets\en_US\" (
    echo [SKIP] en_US preset not found: "%~1"
    echo Check the installed Illustrator preset language.
    set /a FAILED+=1 >nul
    exit /b 0
)
if not exist "%TARGET_DIR%\" (
    mkdir "%TARGET_DIR%"
    if errorlevel 1 (
        echo [ERROR] Cannot create: "%TARGET_DIR%"
        echo See the Windows error above; check Administrator permissions.
        set /a FAILED+=1 >nul
        exit /b 0
    )
)
copy /Y "%SOURCE%" "%TARGET_DIR%\%FILE_NAME%"
if errorlevel 1 (
    echo [ERROR] Copy failed: "%TARGET_DIR%\%FILE_NAME%"
    echo See the Windows error above for the cause.
    echo Check Administrator permissions, free space, and whether the file is in use.
    set /a FAILED+=1 >nul
) else (
    echo [OK] "%TARGET_DIR%\%FILE_NAME%"
    set /a UPDATED+=1 >nul
)
exit /b 0

:finish
echo.
pause
exit /b %RESULT%
