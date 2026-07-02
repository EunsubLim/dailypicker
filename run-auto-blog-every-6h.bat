@echo off
setlocal
cd /d "%~dp0"

echo [DailyPicker] 6시간마다 자동 글쓰기 배치를 시작합니다.
echo [DailyPicker] 이 창을 닫으면 반복 실행이 중지됩니다.

:loop
echo.
echo [DailyPicker] 실행 시각: %date% %time%
"C:\Program Files\nodejs\node.exe" scripts\auto-blog.mjs

echo.
echo [DailyPicker] 다음 실행까지 6시간 대기합니다.
timeout /t 21600 /nobreak
goto loop
