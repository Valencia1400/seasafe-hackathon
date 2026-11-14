# Development workflow

1. Pull current main and create a focused branch.
2. Record which requirement, defect or evidence gap the change addresses.
3. Keep runtime changes separate from documentation-only cleanup.
4. Run relevant tests; distinguish software stand-ins, emulator checks and physical tests.
5. Record meaningful AI contributions, human review, failures and corrections in [ai-process.md](ai-process.md).
6. Review the diff and submit a pull request. Preserve other contributors' work and commit attribution.

Do not commit private network credentials. For hardware tests, record board, firmware commit/version, wiring/setup, date, procedure, observed outcome and evidence. Never replace a failed result with an unexplained pass.

Test commands and limitations: [test plan](../tests/test-plan.md).
