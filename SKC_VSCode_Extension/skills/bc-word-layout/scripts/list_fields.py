#!/usr/bin/env python3
"""
List all available fields from an AL report, grouped by dataitem.

Usage:
    python list_fields.py report.al              # Table format
    python list_fields.py report.al --flat       # Flat list
    python list_fields.py report.al --dataitem Line  # Filter by dataitem
"""

import sys
import argparse
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.core.al_parser import parse_al_report
from scripts.core.models import ReportSchema, DataItem

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


def print_fields(schema: ReportSchema, dataitem_filter: str = None, flat: bool = False):
    """Print fields from report schema."""
    if flat:
        print_fields_flat(schema, dataitem_filter)
    elif RICH_AVAILABLE:
        print_fields_rich(schema, dataitem_filter)
    else:
        print_fields_plain(schema, dataitem_filter)


def print_fields_rich(schema: ReportSchema, dataitem_filter: str = None):
    """Print fields using rich formatting."""
    console.print()
    console.print(Panel.fit(
        f"[bold blue]{schema.report_name}[/bold blue] - Available Fields",
        title="BC Word Layout",
        border_style="blue"
    ))
    console.print()
    
    def print_dataitem_fields(di: DataItem, indent: int = 0):
        # Check filter
        if dataitem_filter and di.name.lower() != dataitem_filter.lower():
            # Still check children
            for child in di.children:
                print_dataitem_fields(child, indent)
            return
        
        if di.columns:
            table = Table(
                title=f"{'  ' * indent}[bold cyan]{di.name}[/bold cyan] [dim]({di.source_table})[/dim]",
                box=box.ROUNDED,
                show_header=True,
                header_style="bold",
                title_justify="left"
            )
            table.add_column("Field Name", style="cyan", no_wrap=True)
            table.add_column("Expression", style="dim")
            table.add_column("Type", style="green", justify="center")
            
            # Sort: data fields first, then labels
            sorted_cols = sorted(di.columns, key=lambda c: (c.is_label, c.name))
            
            for col in sorted_cols:
                field_type = "Label" if col.is_label else "Data"
                expr = col.expression[:45] + "..." if len(col.expression) > 45 else col.expression
                table.add_row(col.name, expr, field_type)
            
            console.print(table)
            console.print()
        
        for child in di.children:
            print_dataitem_fields(child, indent + 1)
    
    for di in schema.dataitems:
        print_dataitem_fields(di)
    
    # Summary
    total = schema.total_columns
    data_count = sum(1 for c in schema.get_all_columns() if not c.is_label)
    label_count = total - data_count
    
    console.print(f"[dim]Total: {total} fields ({data_count} data, {label_count} labels)[/dim]")
    console.print()


def print_fields_plain(schema: ReportSchema, dataitem_filter: str = None):
    """Print fields in plain text."""
    print()
    print("=" * 70)
    print(f"{schema.report_name} - Available Fields")
    print("=" * 70)
    print()
    
    def print_dataitem_fields(di: DataItem, indent: int = 0):
        if dataitem_filter and di.name.lower() != dataitem_filter.lower():
            for child in di.children:
                print_dataitem_fields(child, indent)
            return
        
        if di.columns:
            prefix = "  " * indent
            print(f"{prefix}[{di.name}] ({di.source_table})")
            print(f"{prefix}{'-' * 50}")
            
            sorted_cols = sorted(di.columns, key=lambda c: (c.is_label, c.name))
            
            for col in sorted_cols:
                field_type = "(Lbl)" if col.is_label else ""
                expr = col.expression[:35] if len(col.expression) <= 35 else col.expression[:32] + "..."
                print(f"{prefix}  {col.name:<30} = {expr} {field_type}")
            
            print()
        
        for child in di.children:
            print_dataitem_fields(child, indent + 1)
    
    for di in schema.dataitems:
        print_dataitem_fields(di)
    
    total = schema.total_columns
    data_count = sum(1 for c in schema.get_all_columns() if not c.is_label)
    label_count = total - data_count
    
    print(f"Total: {total} fields ({data_count} data, {label_count} labels)")
    print()


def print_fields_flat(schema: ReportSchema, dataitem_filter: str = None):
    """Print fields as a flat list."""
    all_columns = schema.get_all_columns()
    
    if dataitem_filter:
        all_columns = [c for c in all_columns if c.dataitem.lower() == dataitem_filter.lower()]
    
    # Sort by dataitem, then by name
    sorted_cols = sorted(all_columns, key=lambda c: (c.dataitem, c.is_label, c.name))
    
    for col in sorted_cols:
        print(f"{col.dataitem}.{col.name}")


def main():
    parser = argparse.ArgumentParser(
        description="List all available fields from an AL report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python list_fields.py report.al                    # Table format
  python list_fields.py report.al --flat             # Flat list (for grep)
  python list_fields.py report.al --dataitem Line    # Only Line dataitem
  python list_fields.py report.al --flat | grep -i total
        """
    )
    parser.add_argument("report", help="AL report file (.al)")
    parser.add_argument("--dataitem", "-d", help="Filter by dataitem name")
    parser.add_argument("--flat", "-f", action="store_true", 
                       help="Output as flat list (dataitem.field)")
    
    args = parser.parse_args()
    
    report_path = Path(args.report)
    
    if not report_path.exists():
        print(f"Error: Report file not found: {report_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        schema = parse_al_report(report_path)
        print_fields(schema, args.dataitem, args.flat)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
