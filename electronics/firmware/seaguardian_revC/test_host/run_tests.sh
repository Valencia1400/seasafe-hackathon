#!/bin/sh
# Usage: ARDUINOJSON=/path/to/ArduinoJson/src ./run_tests.sh   (needs g++)
set -e
cd "$(dirname "$0")"
g++ -std=gnu++17 -Wall -Wno-unused-function -x c++ -Istubs -I../Main -I"${ARDUINOJSON:?set ARDUINOJSON to the ArduinoJson src folder}" test_logic.cpp -o /tmp/sg_arduino_test
/tmp/sg_arduino_test
