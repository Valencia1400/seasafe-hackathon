@echo off
rem Starts a local web server for the 3D boat and opens it in your browser.
cd /d "%~dp0"
start "" "http://localhost:8765/"
echo Serving SeaGuardian 3D at http://localhost:8765/  (close this window to stop)
python -m http.server 8765
