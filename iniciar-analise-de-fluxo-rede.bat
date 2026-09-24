@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 22 LTS e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Preparando o Analise de Fluxo pela primeira vez...
  call npm ci
  if errorlevel 1 (
    echo Nao foi possivel instalar os componentes do sistema.
    pause
    exit /b 1
  )
)

call npm run rede
if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro. Verifique se a porta 4173 ja esta em uso.
  pause
)
