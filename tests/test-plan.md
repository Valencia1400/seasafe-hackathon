# Verification plan

Run from the relevant directory:

```bash
cd dashboard
python -m unittest discover -s tests -v
```

```bash
cd vision
python -m unittest test_viewer -v
```

The viewer imports OpenCV; install `vision/requirements.txt` first. Parser tests do not measure detection accuracy.

Control host tests: see [firmware README](../electronics/firmware/seaguardian_revC/README.md) and its `test_host/run_tests.sh`; they require a C++ compiler and ArduinoJson headers. Host stubs do not establish real PWM timing or concurrent task correctness.

## Hardware validation still required

With the electrical lead, identify the flashed firmware and validate the endpoint and telemetry first. Then test calibrated IMU signs, GPS reception/fix, mechanically limited servo travel, motor outputs, emergency stop, watchdog and detected link loss. Use the current firmware bench procedure only after resolving [integration differences](../docs/integration-status.md). Remove propellers for bench motor tests.

Measure physical outputs with appropriate instruments/video. Do not subtract unsynchronized laptop and ESP32 timestamps to claim physical stop latency. Record the trigger definition, last command time and detection delay separately.

Log every trial with build, setup, expected result, observation, pass/fail, correction and evidence. Repeat critical paths and a complete demo sequence; results are pending until recorded.

The [original requirement matrix](../docs/history/test-plan.md) is retained as historical planning, including superseded simulator and sensor proposals.
