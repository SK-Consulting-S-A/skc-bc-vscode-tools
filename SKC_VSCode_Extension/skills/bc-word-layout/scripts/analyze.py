#!/usr/bin/env python3
"""
Analyze AL reports or Word layouts to understand their structure.

Usage:
    python analyze.py report.al          # Analyze AL report
    python analyze.py layout.docx        # Analyze Word layout
    python analyze.py report.al --json   # Output as JSON
"""

import sys
import json
import argparse
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.core.al_parser import parse_al_report
from scripts.core.docx_analyzer import analyze_layout
from scripts.core.models import ReportSchema, LayoutSchema, DataItem

# Try to import rich for pretty output
try:
    from rich.console import Console
    from rich.table import Table
    from rich.tree import Tree
    from rich.panel import Panel
    from rich import box
    RICH_AVAILABLE = True
    console = Console(force_terminal=True, legacy_windows=True)
except ImportError:
    RICH_AVAILABLE = False
    console = None


def print_report_schema(schema: ReportSchema, use_json: bool = False):
    """Print report schema in a formatted way."""
    if use_json:
        print_report_json(schema)
        return
    
    if RICH_AVAILABLE:
        print_report_rich(schema)
    else:
        print_report_plain(schema)


def print_report_rich(schema: ReportSchema):
    """Print report schema using rich formatting."""
    console.print()
    console.print(Panel.fit(
        f"[bold blue]Report {schema.report_id}[/bold blue] - [cyan]{schema.report_name}[/cyan]",
        title="BC Word Layout Analyzer",
        border_style="blue"
    ))
    console.print()
    
    # Report info
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_column("Property", style="dim")
    info_table.add_column("Value")
    info_table.add_row("Caption", schema.caption or "-")
    info_table.add_row("Word Layout", schema.word_layout or "-")
    info_table.add_row("Merge DataItem", schema.word_merge_dataitem or "-")
    info_table.add_row("Total Columns", str(schema.total_columns))
    console.print(info_table)
    console.print()
    
    # DataItems tree
    console.print("[bold]DataItems[/bold]")
    console.print("─" * 60)
    
    def add_dataitem_to_tree(tree, dataitem: DataItem, prefix: str = ""):
        branch = tree.add(
            f"[bold cyan]{dataitem.name}[/bold cyan] "
            f"[dim]({dataitem.source_table})[/dim] - "
            f"[green]{dataitem.column_count} columns[/green]"
            + (" [yellow][temp][/yellow]" if dataitem.is_temporary else "")
        )
        for child in dataitem.children:
            add_dataitem_to_tree(branch, child, prefix + "  ")
    
    tree = Tree("[bold]dataset[/bold]")
    for dataitem in schema.dataitems:
        add_dataitem_to_tree(tree, dataitem)
    console.print(tree)
    console.print()
    
    # Columns table
    console.print("[bold]Columns by DataItem[/bold]")
    console.print("─" * 60)
    
    def print_dataitem_columns(dataitem: DataItem, indent: int = 0):
        if dataitem.columns:
            table = Table(
                title=f"{'  ' * indent}{dataitem.name}",
                box=box.ROUNDED,
                show_header=True,
                header_style="bold"
            )
            table.add_column("Column Name", style="cyan")
            table.add_column("Expression", style="dim")
            table.add_column("Type", style="green")
            
            for col in dataitem.columns[:20]:  # Limit to first 20
                col_type = "Label" if col.is_label else "Data"
                table.add_row(col.name, col.expression[:40], col_type)
            
            if len(dataitem.columns) > 20:
                table.add_row(f"... and {len(dataitem.columns) - 20} more", "", "")
            
            console.print(table)
            console.print()
        
        for child in dataitem.children:
            print_dataitem_columns(child, indent + 1)
    
    for dataitem in schema.dataitems:
        print_dataitem_columns(dataitem)


def print_report_plain(schema: ReportSchema):
    """Print report schema in plain text."""
    print()
    print("=" * 60)
    print(f"BC Word Layout Analyzer")
    print("=" * 60)
    print(f"Report {schema.report_id} - {schema.report_name}")
    print("-" * 60)
    print(f"Caption:        {schema.caption or '-'}")
    print(f"Word Layout:    {schema.word_layout or '-'}")
    print(f"Merge DataItem: {schema.word_merge_dataitem or '-'}")
    print(f"Total Columns:  {schema.total_columns}")
    print()
    
    print("DataItems")
    print("-" * 60)
    
    def print_dataitem(dataitem: DataItem, indent: int = 0):
        prefix = "  " * indent
        temp = " [temp]" if dataitem.is_temporary else ""
        print(f"{prefix}{dataitem.name} ({dataitem.source_table}) - {dataitem.column_count} columns{temp}")
        for child in dataitem.children:
            print_dataitem(child, indent + 1)
    
    for dataitem in schema.dataitems:
        print_dataitem(dataitem)
    
    print()
    print("Columns")
    print("-" * 60)
    
    def print_columns(dataitem: DataItem, indent: int = 0):
        if dataitem.columns:
            print(f"\n{'  ' * indent}[{dataitem.name}]")
            for col in dataitem.columns[:15]:
                col_type = "(Lbl)" if col.is_label else ""
                print(f"{'  ' * indent}  {col.name} = {col.expression[:40]} {col_type}")
            if len(dataitem.columns) > 15:
                print(f"{'  ' * indent}  ... and {len(dataitem.columns) - 15} more")
        for child in dataitem.children:
            print_columns(child, indent + 1)
    
    for dataitem in schema.dataitems:
        print_columns(dataitem)
    print()


def print_report_json(schema: ReportSchema):
    """Print report schema as JSON."""
    def dataitem_to_dict(di: DataItem) -> dict:
        return {
            "name": di.name,
            "source_table": di.source_table,
            "column_count": di.column_count,
            "is_temporary": di.is_temporary,
            "columns": [{"name": c.name, "expression": c.expression, "is_label": c.is_label} for c in di.columns],
            "children": [dataitem_to_dict(c) for c in di.children]
        }
    
    data = {
        "report_id": schema.report_id,
        "report_name": schema.report_name,
        "caption": schema.caption,
        "word_layout": schema.word_layout,
        "word_merge_dataitem": schema.word_merge_dataitem,
        "total_columns": schema.total_columns,
        "dataitems": [dataitem_to_dict(di) for di in schema.dataitems]
    }
    print(json.dumps(data, indent=2))


def print_layout_schema(schema: LayoutSchema, use_json: bool = False):
    """Print layout schema in a formatted way."""
    if use_json:
        print_layout_json(schema)
        return
    
    if RICH_AVAILABLE:
        print_layout_rich(schema)
    else:
        print_layout_plain(schema)


def print_layout_rich(schema: LayoutSchema):
    """Print layout schema using rich formatting."""
    console.print()
    console.print(Panel.fit(
        f"[bold blue]{schema.file_path.name}[/bold blue]",
        title="BC Word Layout Analyzer",
        border_style="blue"
    ))
    console.print()
    
    # Summary
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_column("Property", style="dim")
    info_table.add_column("Value")
    info_table.add_row("Content Controls", str(schema.total_controls))
    info_table.add_row("Repeating Sections", str(len(schema.repeating_sections)))
    info_table.add_row("Custom XML Parts", str(len(schema.custom_xml_parts)))
    console.print(info_table)
    console.print()
    
    # Content Controls
    if schema.content_controls:
        console.print("[bold]Content Controls[/bold]")
        console.print("─" * 60)
        
        table = Table(box=box.ROUNDED, show_header=True, header_style="bold")
        table.add_column("Tag", style="cyan")
        table.add_column("Alias", style="dim")
        table.add_column("Type", style="green")
        table.add_column("In Section", style="yellow")
        
        for cc in schema.content_controls[:30]:
            table.add_row(
                cc.tag or "-",
                cc.alias or "-",
                cc.control_type,
                cc.in_repeating_section or "-"
            )
        
        if len(schema.content_controls) > 30:
            table.add_row(f"... and {len(schema.content_controls) - 30} more", "", "", "")
        
        console.print(table)
        console.print()
    
    # Repeating Sections
    if schema.repeating_sections:
        console.print("[bold]Repeating Sections[/bold]")
        console.print("─" * 60)
        
        for section in schema.repeating_sections:
            console.print(f"  [cyan]{section.name}[/cyan] - {len(section.controls)} controls")
        console.print()


def print_layout_plain(schema: LayoutSchema):
    """Print layout schema in plain text."""
    print()
    print("=" * 60)
    print(f"BC Word Layout Analyzer")
    print("=" * 60)
    print(f"File: {schema.file_path.name}")
    print("-" * 60)
    print(f"Content Controls:   {schema.total_controls}")
    print(f"Repeating Sections: {len(schema.repeating_sections)}")
    print(f"Custom XML Parts:   {len(schema.custom_xml_parts)}")
    print()
    
    if schema.content_controls:
        print("Content Controls")
        print("-" * 60)
        for cc in schema.content_controls[:30]:
            section = f" [in {cc.in_repeating_section}]" if cc.in_repeating_section else ""
            print(f"  {cc.tag or '-':<30} ({cc.control_type}){section}")
        if len(schema.content_controls) > 30:
            print(f"  ... and {len(schema.content_controls) - 30} more")
        print()


def print_layout_json(schema: LayoutSchema):
    """Print layout schema as JSON."""
    data = {
        "file": str(schema.file_path),
        "total_controls": schema.total_controls,
        "content_controls": [
            {"tag": cc.tag, "alias": cc.alias, "type": cc.control_type, "in_section": cc.in_repeating_section}
            for cc in schema.content_controls
        ],
        "repeating_sections": [
            {"name": rs.name, "control_count": len(rs.controls)}
            for rs in schema.repeating_sections
        ],
        "custom_xml_parts": schema.custom_xml_parts
    }
    print(json.dumps(data, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Analyze AL reports or Word layouts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python analyze.py report.al          # Analyze AL report
  python analyze.py layout.docx        # Analyze Word layout
  python analyze.py report.al --json   # Output as JSON
        """
    )
    parser.add_argument("file", help="AL report file (.al) or Word layout (.docx)")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    file_path = Path(args.file)
    
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        if file_path.suffix.lower() == '.al':
            schema = parse_al_report(file_path)
            print_report_schema(schema, args.json)
        elif file_path.suffix.lower() == '.docx':
            schema = analyze_layout(file_path)
            print_layout_schema(schema, args.json)
        else:
            print(f"Error: Unsupported file type: {file_path.suffix}", file=sys.stderr)
            print("Supported types: .al (AL report), .docx (Word layout)", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
