@echo off
cd /d "D:\Google_Download\dafei"
set ELECTRON_RUN_AS_NODE=
set NODE_ENV=development
start "" "D:\Google_Download\dafei\node_modules\electron\dist\electron.exe" . --remote-debugging-port=9222
exit
