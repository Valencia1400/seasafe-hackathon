@echo off
rem Starts the local film server and opens the SeaGuardian film in your browser.
cd /d "%~dp0..\.."
start "" "http://localhost:8770/film/cinematic.html"
echo Film: http://localhost:8770/film/cinematic.html   (close this window to stop)
echo Export MP4: http://localhost:8770/film/cinematic.html?export
python "presentation\film\tools\serve.py" 8770
