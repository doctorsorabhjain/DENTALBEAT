@echo off
setlocal enabledelayedexpansion
title Permanent Sequence Renamer (Time-Based)

:start
cls
echo ======================================================
echo       PERMANENT TIME-BASED SEQUENTIAL RENAMER
echo ======================================================
echo.
set /p "targetDir=PASTE FOLDER PATH HERE: "
set "targetDir=%targetDir:"=%"

if not exist "%targetDir%" (
    echo [ERROR] Folder path is invalid.
    pause
    goto start
)

cd /d "%targetDir%"

:: --- PHASE 1: TEMPORARY RENAME (BY DATE) ---
:: /od sorts by DATE (Oldest first). This handles 1.jpg and 1(2).jpg perfectly.
echo Phase 1: Sorting files by time created...
set /a count=1
for /f "delims=" %%f in ('dir /b /a-d /od') do (
    if /i "%%f" neq "%~nx0" (
        set "ext=%%~xf"
        ren "%%f" "TEMP_SEQ_!count!!ext!"
        set /a count+=1
    )
)

:: --- PHASE 2: FINAL CLEANUP ---
echo Phase 2: Applying final numbers (1, 2, 3...)...
for /f "delims=" %%f in ('dir /b /a-d "TEMP_SEQ_*"') do (
    set "oldName=%%f"
    set "newName=!oldName:TEMP_SEQ_=!"
    ren "%%f" "!newName!"
)

echo ------------------------------------------------------
echo DONE: Files are now in a clean timeline sequence.
echo.
set /p "again=Do another folder? (y/n): "
if /i "%again%"=="y" goto start
exit
