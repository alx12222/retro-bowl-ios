@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo.
echo === Retro Bowl Modded - Build iOS IPA on Windows ===
echo.

rem --- 1. Preflight
where gh >nul 2>&1
if errorlevel 1 goto :no_gh

where git >nul 2>&1
if errorlevel 1 goto :no_git

gh auth status >nul 2>&1
if errorlevel 1 goto :no_auth

rem --- 2. Git repo init
if not exist ".git" call :init_repo
if errorlevel 1 goto :fail

rem --- 3. Figure out GitHub user + target repo name
set GH_USER=
for /f "tokens=*" %%u in ('gh api user --jq .login') do set GH_USER=%%u
if "!GH_USER!"=="" goto :no_user
set REPO_NAME=retro-bowl-ios

rem --- 4. Remote status
set REMOTE=
for /f "tokens=*" %%r in ('git remote get-url origin 2^>nul') do set REMOTE=%%r

set STEP_RC=0
if "!REMOTE!"=="" call :link_or_create_repo
if !STEP_RC!==1 goto :fail

call :push_changes
if !STEP_RC!==1 goto :fail

rem --- 5. Trigger workflow
echo.
echo Triggering macOS build on GitHub Actions...
gh workflow run "Build iOS IPA"
if errorlevel 1 goto :no_workflow

rem --- 6. Wait for run
echo Waiting for run to start...
set RUN_ID=
set TRIES=0
:wait_run
for /f "tokens=*" %%i in ('gh run list --workflow "Build iOS IPA" --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set RUN_ID=%%i
if "!RUN_ID!"=="" (
    set /a TRIES+=1
    if !TRIES! GEQ 20 goto :no_run
    timeout /t 1 /nobreak >nul
    goto :wait_run
)

echo Run ID: !RUN_ID!
echo.
echo Streaming build log (first build ~12 min for pods + xcodebuild)...
echo.
gh run watch !RUN_ID! --exit-status
if errorlevel 1 goto :build_failed

rem --- 7. Download artifact
echo.
echo Downloading IPA artifact...
if exist dist rmdir /s /q dist
mkdir dist
gh run download !RUN_ID! --name RetroBowlModded-unsigned-ipa --dir dist
if errorlevel 1 goto :no_artifact

echo.
echo ===========================================================
echo  DONE.
echo.
echo  IPA at:
echo    %cd%\dist\RetroBowlModded.ipa
echo.
echo  This IPA is UNSIGNED. Install with:
echo    - AltStore / SideStore  (free Apple ID, 7-day re-sign)
echo    - Sideloadly            (desktop re-signer, free Apple ID)
echo    - TrollStore            (permanent on compatible iOS)
echo    - Xcode on a Mac        (paid developer account)
echo ===========================================================
echo.
pause
exit /b 0

rem ============================================================================
rem Subroutines
rem ============================================================================

:init_repo
echo Initializing git repo...
git init -b main >nul 2>&1
git add -A >nul 2>&1
git -c user.email=retrobowl@local -c user.name=RetroBowlBuilder commit -m "Initial import" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Initial commit failed.
    exit /b 1
)
exit /b 0

:link_or_create_repo
echo Checking for existing repo !GH_USER!/!REPO_NAME! on GitHub...
gh repo view !GH_USER!/!REPO_NAME! >nul 2>&1
if errorlevel 1 goto :create_new_repo
echo Repo exists already. Linking local to it.
git remote remove origin >nul 2>&1
git remote add origin https://github.com/!GH_USER!/!REPO_NAME!.git
if errorlevel 1 (
    echo [ERROR] Could not add remote.
    set STEP_RC=1
    exit /b 1
)
set REMOTE=https://github.com/!GH_USER!/!REPO_NAME!.git
exit /b 0

:create_new_repo
echo Creating private repo !GH_USER!/!REPO_NAME! ...
gh repo create !GH_USER!/!REPO_NAME! --private --source=. --push --remote=origin
if errorlevel 1 (
    echo [ERROR] gh repo create failed.
    set STEP_RC=1
    exit /b 1
)
set REMOTE=https://github.com/!GH_USER!/!REPO_NAME!.git
exit /b 0

:push_changes
echo Pushing latest changes...
git add -A >nul 2>&1
git -c user.email=retrobowl@local -c user.name=RetroBowlBuilder commit -m "Update build" >nul 2>&1
git push -u origin HEAD:main
if not errorlevel 1 exit /b 0
echo Push rejected (remote has unrelated history). Force-pushing...
git push -u origin HEAD:main --force
if errorlevel 1 (
    echo [ERROR] git push failed even with --force. Try: gh auth status
    set STEP_RC=1
    exit /b 1
)
exit /b 0

rem ============================================================================
rem Error exit labels
rem ============================================================================

:no_gh
echo [ERROR] GitHub CLI not installed.
echo   Run: winget install -e --id GitHub.cli
echo   Then: gh auth login
goto :fail

:no_git
echo [ERROR] Git not installed.
echo   Run: winget install -e --id Git.Git
goto :fail

:no_auth
echo [ERROR] Not logged into GitHub CLI.
echo   Run: gh auth login
goto :fail

:no_user
echo [ERROR] Could not read GitHub username. Try: gh auth login
goto :fail

:no_workflow
echo [ERROR] Could not trigger workflow.
echo   Check that .github\workflows\build-ios.yml exists and Actions are enabled.
goto :fail

:no_run
echo [ERROR] Workflow run did not appear within 20 seconds.
goto :fail

:build_failed
echo.
echo [ERROR] Build failed on the macOS runner.
echo Opening the run log in your browser...
gh run view !RUN_ID! --web
goto :fail

:no_artifact
echo [ERROR] Could not download artifact. Did the IPA get produced?
gh run view !RUN_ID! --web
goto :fail

:fail
echo.
echo Build aborted.
pause
exit /b 1
