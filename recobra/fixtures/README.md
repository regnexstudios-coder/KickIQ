# Fixtures

**All files here are SYNTHETIC** (invented order ids, amounts, no real customers). They exercise the
parsers' fuzzy header matching, mixed locales (`1.234,56` vs `1234.56`), delimiters and bad rows.
They are NOT proof that the parsers read the platforms' real exports. Replace/add real (redacted)
exports as `real-*.csv|xlsx` and add tests before trusting them.
