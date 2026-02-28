
from app.worker.processor import extract_files_from_diff
from app.utils.codeguardignore import filter_diff

diff = "diff --git a/test.py b/test.py\nnew file mode 100644\n--- /dev/null\n+++ b/test.py\n@@ -0,0 +1 @@\n+print('hello')"

print(f"Testing diff: {diff!r}")

extracted = extract_files_from_diff(diff)
print(f"Extracted files: {extracted}")

filtered_diff, kept_files, ignored_files = filter_diff(diff, [])
print(f"Filtered files: {kept_files}")
print(f"Ignored files: {ignored_files}")
print(f"Filtered diff len: {len(filtered_diff)}")

if "test.py" not in kept_files:
    print("FAIL: test.py missing from kept_files")
else:
    print("SUCCESS: test.py found")
