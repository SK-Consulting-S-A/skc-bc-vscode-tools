#!/usr/bin/env python3
"""
Validate a Word layout against its AL report definition.

Usage:
    python validate.py report.al layout.docx
    python validate.py report.al layout.docx --strict
"""

import sys
import argparse
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.core.al_parser import parse_al_report
from scripts.core.docx_analyzer import analyze_layout
from scripts.core.models import (
    ReportSchema, LayoutSchema, ValidationResult, 
    ValidationIssue, Severity
)

# Try to import rich for pretty output
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich import box
    RICH_AVAILABLE = True
    console = Console(force_terminal=True, legacy_windows=True)
except ImportError:
    RICH_AVAILABLE = False
    console = None


def validate(report: ReportSchema, layout: LayoutSchema) -> ValidationResult:
    """Validate a layout against a report schema."""
    issues = []
    
    # Get all column names from report
    report_columns = report.get_column_names()
    report_columns_lower = {c.lower() for c in report_columns}
    
    # Get all content control field names from layout
    # BC layouts use path-based naming, get_field_names() extracts actual field names
    layout_tags = layout.get_field_names()
    layout_tags_lower = {f.lower() for f in layout_tags}
    
    # Get dataitem names for comparison
    dataitem_names_lower = set()
    def collect_dataitem_names(items):
        for di in items:
            dataitem_names_lower.add(di.name.lower())
            collect_dataitem_names(di.children)
    collect_dataitem_names(report.dataitems)
    
    # Check for fields in layout that don't exist in report
    for field in layout_tags:
        if field and field.lower() not in report_columns_lower:
            # Skip system fields like repeating section markers
            if field.startswith('#Nav:') or not field:
                continue
            # Skip dataitem names (used for repeating sections)
            if field.lower() in dataitem_names_lower:
                continue
            issues.append(ValidationIssue(
                severity=Severity.WARNING,
                code="ORPHAN_FIELD",
                message=f"Field '{field}' in layout not found in report",
                field=field,
                suggestion="Check spelling or remove unused content control"
            ))
    
    # Check for required fields not in layout (labels are optional)
    all_columns = report.get_all_columns()
    data_columns = [c for c in all_columns if not c.is_label]
    
    missing_data = []
    for col in data_columns:
        if col.name.lower() not in layout_tags_lower:
            missing_data.append(col.name)
    
    if missing_data:
        # Group as info - many fields are intentionally not used
        issues.append(ValidationIssue(
            severity=Severity.INFO,
            code="UNUSED_FIELDS",
            message=f"{len(missing_data)} data fields from report not used in layout",
            suggestion="This is often intentional - layouts don't need all fields"
        ))
    
    # Check WordMergeDataItem if specified
    if report.word_merge_dataitem:
        merge_di = report.get_dataitem(report.word_merge_dataitem)
        if not merge_di:
            issues.append(ValidationIssue(
                severity=Severity.ERROR,
                code="INVALID_MERGE_DATAITEM",
                message=f"WordMergeDataItem '{report.word_merge_dataitem}' not found in report",
                suggestion="Check the WordMergeDataItem property in the report"
            ))
    
    # Check for case mismatches (common issue)
    for tag in layout_tags:
        if tag:
            matches = [c for c in report_columns if c.lower() == tag.lower() and c != tag]
            if matches:
                issues.append(ValidationIssue(
                    severity=Severity.WARNING,
                    code="CASE_MISMATCH",
                    message=f"Field '{tag}' has case mismatch with report column '{matches[0]}'",
                    field=tag,
                    suggestion=f"Consider using exact case: '{matches[0]}'"
                ))
    
    return ValidationResult(
        report_schema=report,
        layout_schema=layout,
        issues=issues
    )


def print_validation_result(result: ValidationResult, strict: bool = False):
    """Print validation result."""
    if RICH_AVAILABLE:
        print_validation_rich(result, strict)
    else:
        print_validation_plain(result, strict)


def print_validation_rich(result: ValidationResult, strict: bool):
    """Print validation result using rich formatting."""
    console.print()
    console.print(Panel.fit(
        "[bold]BC Word Layout Validator[/bold]",
        border_style="blue"
    ))
    console.print()
    
    # Summary
    report = result.report_schema
    layout = result.layout_schema
    
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_column("", style="dim")
    info_table.add_column("")
    info_table.add_row("Report", f"{report.report_name} ({report.total_columns} columns)")
    info_table.add_row("Layout", f"{layout.file_path.name} ({layout.total_controls} controls)")
    info_table.add_row("Matched", f"{result.matched_fields} fields")
    console.print(info_table)
    console.print()
    
    # Status
    is_valid = result.is_valid if not strict else (result.error_count == 0 and result.warning_count == 0)
    status_color = "green" if is_valid else "red"
    status_text = "PASS" if is_valid else "FAIL"
    
    console.print(f"[bold {status_color}]Status: {status_text}[/bold {status_color}]")
    console.print()
    
    # Results table
    results_table = Table(box=box.ROUNDED, show_header=True, header_style="bold")
    results_table.add_column("Status", justify="center")
    results_table.add_column("Count", justify="right")
    results_table.add_column("Description")
    
    if result.matched_fields > 0:
        results_table.add_row("[green]✓[/green]", str(result.matched_fields), "Fields mapped correctly")
    if result.error_count > 0:
        results_table.add_row("[red]✗[/red]", str(result.error_count), "Errors (must fix)")
    if result.warning_count > 0:
        results_table.add_row("[yellow]⚠[/yellow]", str(result.warning_count), "Warnings (should review)")
    if result.info_count > 0:
        results_table.add_row("[blue]ℹ[/blue]", str(result.info_count), "Information")
    
    console.print(results_table)
    console.print()
    
    # Issues detail
    if result.issues:
        console.print("[bold]Issues[/bold]")
        console.print("─" * 60)
        
        for issue in result.issues:
            if issue.severity == Severity.ERROR:
                icon = "[red]✗[/red]"
                style = "red"
            elif issue.severity == Severity.WARNING:
                icon = "[yellow]⚠[/yellow]"
                style = "yellow"
            else:
                icon = "[blue]ℹ[/blue]"
                style = "dim"
            
            console.print(f"  {icon} [{style}]{issue.message}[/{style}]")
            if issue.suggestion:
                console.print(f"      [dim]→ {issue.suggestion}[/dim]")
        
        console.print()


def print_validation_plain(result: ValidationResult, strict: bool):
    """Print validation result in plain text."""
    print()
    print("=" * 60)
    print("BC Word Layout Validator")
    print("=" * 60)
    
    report = result.report_schema
    layout = result.layout_schema
    
    print(f"Report: {report.report_name} ({report.total_columns} columns)")
    print(f"Layout: {layout.file_path.name} ({layout.total_controls} controls)")
    print(f"Matched: {result.matched_fields} fields")
    print()
    
    is_valid = result.is_valid if not strict else (result.error_count == 0 and result.warning_count == 0)
    status_text = "PASS" if is_valid else "FAIL"
    
    print(f"Status: {status_text}")
    print("-" * 60)
    
    if result.matched_fields > 0:
        print(f"  [PASS] {result.matched_fields} fields mapped correctly")
    if result.error_count > 0:
        print(f"  [ERROR] {result.error_count} errors (must fix)")
    if result.warning_count > 0:
        print(f"  [WARN] {result.warning_count} warnings (should review)")
    if result.info_count > 0:
        print(f"  [INFO] {result.info_count} information items")
    
    print()
    
    if result.issues:
        print("Issues")
        print("-" * 60)
        
        for issue in result.issues:
            prefix = {
                Severity.ERROR: "[ERROR]",
                Severity.WARNING: "[WARN]",
                Severity.INFO: "[INFO]"
            }[issue.severity]
            
            print(f"  {prefix} {issue.message}")
            if issue.suggestion:
                print(f"         -> {issue.suggestion}")
        
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Validate a Word layout against its AL report definition",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate.py report.al layout.docx
  python validate.py report.al layout.docx --strict
        """
    )
    parser.add_argument("report", help="AL report file (.al)")
    parser.add_argument("layout", help="Word layout file (.docx)")
    parser.add_argument("--strict", "-s", action="store_true", 
                       help="Treat warnings as errors")
    
    args = parser.parse_args()
    
    report_path = Path(args.report)
    layout_path = Path(args.layout)
    
    if not report_path.exists():
        print(f"Error: Report file not found: {report_path}", file=sys.stderr)
        sys.exit(1)
    
    if not layout_path.exists():
        print(f"Error: Layout file not found: {layout_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        report_schema = parse_al_report(report_path)
        layout_schema = analyze_layout(layout_path)
        
        result = validate(report_schema, layout_schema)
        print_validation_result(result, args.strict)
        
        # Exit code based on validation result
        if args.strict:
            sys.exit(0 if result.error_count == 0 and result.warning_count == 0 else 1)
        else:
            sys.exit(0 if result.is_valid else 1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
