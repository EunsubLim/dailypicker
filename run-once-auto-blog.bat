@echo off
setlocal
cd /d "%~dp0"

echo [DailyPicker] 자동 글쓰기 1회 실행을 시작합니다.
"C:\Program Files\nodejs\node.exe" scripts\auto-blog.mjs

echo.
echo [DailyPicker] 완료되었습니다. 창을 닫아도 됩니다.
pause
