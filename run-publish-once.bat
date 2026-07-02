@echo off
setlocal
cd /d "%~dp0"

echo [DailyPicker] 글 작성, GitHub 저장, Netlify 배포를 1회 실행합니다.
"C:\Program Files\nodejs\node.exe" scripts\auto-blog-publish.mjs

echo.
echo [DailyPicker] 완료되었습니다. 창을 닫아도 됩니다.
pause
