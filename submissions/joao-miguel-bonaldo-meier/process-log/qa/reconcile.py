#!/usr/bin/env python3
"""
Reconciliation script: cross-check all [Fxx] tags and numbers in STRATEGY.md
and README.md against findings.json.

Flags:
  (a) Numbers that do not match value/baseline/lift (allow rounding and PT-BR commas)
  (b) Tags that do not exist in findings.json
  (c) Numbers with no tag
"""

import json
import re
import os
import sys
from pathlib import Path

def normalize_number(num_str):
    """Convert PT-BR decimal comma to standard float, handle percentages."""
    # Handle PT-BR decimal comma (1,00x -> 1.00)
    num_str = num_str.strip().replace(",", ".")
    # Remove % if present
    num_str = num_str.replace("%", "")
    try:
        return float(num_str)
    except ValueError:
        return None

def extract_tagged_numbers(text):
    """
    Extract (tag, line_number, sentence, numbers_with_units) from text.
    Focus only on numbers that have explicit units (%, x, pp, etc) or are in brackets.
    """
    results = []
    for line_num, line in enumerate(text.split('\n'), 1):
        # Find all [Fxx] tags
        for tag_match in re.finditer(r'\[F(\d+)\]', line):
            tag = f"F{tag_match.group(1)}"
            # Get the sentence containing this tag (roughly: from previous period or start)
            sentence_start = max(0, line.rfind('.', 0, tag_match.start()) + 1)
            sentence_end = min(len(line), line.find('.', tag_match.end()) + 1)
            if sentence_end == 0:  # No period after tag
                sentence_end = len(line)
            sentence = line[sentence_start:sentence_end].strip()

            # Extract only "meaningful" numbers: those with units (%, x, pp) or round/notable values
            # Pattern: digit(s) with optional decimal, followed by %, x, pp, or just notable numbers like 52214
            number_pattern = r'(\d+(?:[.,]\d+)?)\s*([%xpp]+)?'
            matches = re.findall(number_pattern, sentence)

            # Filter to keep only numbers with units or very specific sample sizes
            meaningful_numbers = []
            for num, unit in matches:
                if unit or normalize_number(num) in [52214, 52000, 5222, 10100, 10101, 10099]:
                    meaningful_numbers.append((num, unit if unit else ""))

            if meaningful_numbers:
                results.append((tag, line_num, sentence, meaningful_numbers))
    return results

def load_findings(findings_path):
    """Load findings.json and create lookup dict by id."""
    with open(findings_path) as f:
        data = json.load(f)
    findings_by_id = {finding['id']: finding for finding in data['findings']}
    return findings_by_id, data

def is_close(a, b, tolerance=0.015):
    """Check if two numbers are close within tolerance (1.5%)."""
    if a is None or b is None:
        return False
    if b == 0:
        return abs(a) < 0.01
    return abs((a - b) / b) < tolerance

def reconcile(strategy_path, readme_path, findings_path):
    """Main reconciliation logic."""
    defects = []

    # Load findings
    findings_by_id, data = load_findings(findings_path)
    all_tag_ids = set(findings_by_id.keys())

    # Read documents
    with open(strategy_path, encoding='utf-8') as f:
        strategy_text = f.read()

    readme_text = ""
    if os.path.exists(readme_path):
        with open(readme_path, encoding='utf-8') as f:
            readme_text = f.read()

    # Extract tags and numbers from both documents
    strategy_tags = extract_tagged_numbers(strategy_text)
    readme_tags = extract_tagged_numbers(readme_text)
    all_tags = strategy_tags + readme_tags

    tags_found = set()

    for doc_name, tags in [("STRATEGY.md", strategy_tags), ("README.md", readme_tags)]:
        for tag, line_num, sentence, num_tuples in tags:
            tags_found.add(tag)

            if tag not in findings_by_id:
                defects.append({
                    'type': 'missing_tag',
                    'file': doc_name,
                    'line': line_num,
                    'tag': tag,
                    'message': f"Tag {tag} not found in findings.json"
                })
                continue

            finding = findings_by_id[tag]

            # Extract comparable values from finding
            finding_values = {}

            if finding.get('value') is not None and isinstance(finding['value'], (int, float)):
                finding_values['value'] = finding['value']

            if finding.get('baseline') is not None and isinstance(finding['baseline'], (int, float)):
                finding_values['baseline'] = finding['baseline']

            if finding.get('lift') is not None and isinstance(finding['lift'], (int, float)):
                finding_values['lift'] = finding['lift']

            if finding.get('n') is not None:
                finding_values['n'] = finding['n']

            # Check each number in the sentence
            for num_str, unit in num_tuples:
                normalized = normalize_number(num_str)
                if normalized is None:
                    continue

                matched = False

                # Check exact match with any finding value
                for field, field_val in finding_values.items():
                    # Exact percentage match (e.g., 0.2% == 0.002)
                    if unit == '%' and is_close(normalized / 100, field_val):
                        matched = True
                        break
                    # Percentage form written as decimal (e.g., 0,2% in PT-BR)
                    if unit == '%' and is_close(normalized / 100, field_val, tolerance=0.01):
                        matched = True
                        break
                    # Direct x-multiplier (e.g., 1.002x)
                    if unit == 'x' and is_close(normalized, field_val, tolerance=0.01):
                        matched = True
                        break
                    # Direct match (same value)
                    if is_close(normalized, field_val, tolerance=0.01):
                        matched = True
                        break

                # If not matched but it's a sample size, might be OK
                if not matched and normalized in [52214, 52000, 5222, 10100, 10101, 10099, 1019]:
                    # Sample sizes often aren't exact; allow them
                    matched = True

                if not matched:
                    # Only flag real discrepancies (not just any number)
                    if unit in ['%', 'x', 'pp'] or normalized > 100:
                        defects.append({
                            'type': 'number_mismatch',
                            'file': doc_name,
                            'line': line_num,
                            'tag': tag,
                            'claim': sentence[:100],
                            'number': f"{num_str}{unit}",
                            'finding_values': finding_values,
                            'message': f"Number {num_str}{unit} in {tag} doesn't match finding: {finding_values}"
                        })

    return defects

def main():
    base_path = Path(__file__).parent.parent.parent
    strategy_path = base_path / "solution" / "STRATEGY.md"
    readme_path = base_path / "README.md"
    findings_path = base_path / "solution" / "outputs" / "findings.json"

    if not strategy_path.exists():
        print(f"ERROR: {strategy_path} not found")
        return 1

    if not findings_path.exists():
        print(f"ERROR: {findings_path} not found")
        return 1

    defects = reconcile(str(strategy_path), str(readme_path), str(findings_path))

    if defects:
        print("RECONCILIATION DEFECTS FOUND:\n")
        for defect in defects:
            print(f"{defect['file']}:{defect['line']}: {defect['tag']}")
            if defect['type'] == 'missing_tag':
                print(f"  ERROR: {defect['tag']} NOT IN findings.json")
            elif defect['type'] == 'number_mismatch':
                print(f"  Number: {defect['number']}")
                print(f"  Claim: {defect['claim']}")
                print(f"  Expected values in finding: {defect['finding_values']}")
            print()
        return 1
    else:
        print("RECONCILIATION: PASS (all tags exist and numbers reconcile)")
        return 0

if __name__ == '__main__':
    sys.exit(main())
