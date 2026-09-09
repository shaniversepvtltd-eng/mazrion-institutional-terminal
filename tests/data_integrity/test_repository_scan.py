import os
import re
import sys

def scan_repo():
    print("=== [TEST 6] ZERO-FABRICATION FORENSIC REPOSITORY SCAN ===")
    
    # Critical disallowed market numbers / strings in production logic
    strict_disallowed = [
        (r'4450\.00', "Hardcoded BSL Flip"),
        (r'4488\.50', "Hardcoded Sell Wall"),
        (r'4491\.23', "Hardcoded PDH"),
        (r'4386\.70', "Hardcoded SSL Sweep"),
        (r'4380\.00', "Hardcoded Buy Wall"),
        (r'4368\.00', "Hardcoded Hard SL"),
        (r'12,450 Lots', "Hardcoded BSL Lots"),
        (r'18,200 Lots', "Hardcoded SSL Lots"),
        (r'POST-NFP', "Static NFP Label"),
        (r'NFP Beat \+162K', "Static NFP Comment"),
        (r'DXY \+104\.75', "Static DXY Comment"),
        (r'0\.952', "Hardcoded Fractal Pearson r"),
        (r'GEN #42', "Static Genetic Gen ID"),
    ]
    
    violations = []
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # We inspect public HTML/JS and API
    for root, dirs, files in os.walk(base_dir):
        # Ignore tests, node_modules, git
        if any(ignored in root for ignored in ["node_modules", ".git", "tests"]):
            continue
        for file in files:
            if file.endswith((".html", ".js")):
                filepath = os.path.join(root, file)
                relpath = os.path.relpath(filepath, base_dir)
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line_idx, line in enumerate(f):
                        for pattern, desc in strict_disallowed:
                            if re.search(pattern, line):
                                violations.append((relpath, line_idx + 1, desc, line.strip()[:100]))
    
    if violations:
        print(f"FAILED: Found {len(violations)} hardcoded market value violations:")
        for r, l, d, text in violations[:15]:
            print(f"  ❌ [{r}:L{l}] {d} -> {text}")
        if len(violations) > 15:
            print(f"  ... and {len(violations) - 15} more.")
        return False
    else:
        print(">>> PASS: Zero hardcoded market values found in repository.\n")
        return True

if __name__ == "__main__":
    passed = scan_repo()
    if not passed:
        sys.exit(1)
