"""
AL Report Parser - Extracts dataitem and column structure from AL report files.
"""

import re
from pathlib import Path
from typing import List, Optional, Tuple
from .models import ReportSchema, DataItem, Column


class ALReportParser:
    """Parser for Business Central AL report files."""
    
    def __init__(self):
        self.content = ""
        self.lines: List[str] = []
        
    def parse(self, file_path: Path) -> ReportSchema:
        """Parse an AL report file and return its schema."""
        file_path = Path(file_path)
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            self.content = f.read()
        self.lines = self.content.splitlines()
        
        # Extract report header
        report_id, report_name = self._parse_report_header()
        caption = self._parse_caption()
        word_layout = self._parse_word_layout()
        word_merge_dataitem = self._parse_word_merge_dataitem()
        
        # Extract dataitems
        dataitems = self._parse_dataitems()
        
        return ReportSchema(
            report_id=report_id,
            report_name=report_name,
            caption=caption,
            file_path=file_path,
            word_layout=word_layout,
            word_merge_dataitem=word_merge_dataitem,
            dataitems=dataitems
        )
    
    def _parse_report_header(self) -> Tuple[int, str]:
        """Extract report ID and name.
        
        Handles both quoted and unquoted report names:
        - report 61600 "StandardSalesQuote017GAR"
        - report 70307220 QCCertOfAnalysis006SKC
        """
        # Try quoted name first
        pattern_quoted = r'report\s+(\d+)\s+"([^"]+)"'
        match = re.search(pattern_quoted, self.content, re.IGNORECASE)
        if match:
            return int(match.group(1)), match.group(2)
        
        # Try unquoted name (identifier)
        pattern_unquoted = r'report\s+(\d+)\s+(\w+)'
        match = re.search(pattern_unquoted, self.content, re.IGNORECASE)
        if match:
            return int(match.group(1)), match.group(2)
        
        return 0, "Unknown"
    
    def _parse_caption(self) -> str:
        """Extract report caption."""
        pattern = r"Caption\s*=\s*'([^']+)'"
        match = re.search(pattern, self.content)
        if match:
            return match.group(1)
        return ""
    
    def _parse_word_layout(self) -> Optional[str]:
        """Extract WordLayout property.
        
        Checks both traditional WordLayout property and modern rendering section:
        - WordLayout = './path/to/layout.docx';
        - rendering { layout(...) { LayoutFile = './path/to/layout.docx'; Type = Word; } }
        """
        # Try traditional WordLayout property first
        pattern = r"WordLayout\s*=\s*'([^']+)'"
        match = re.search(pattern, self.content)
        if match:
            return match.group(1)
        
        # Try modern rendering section
        rendering_layout = self._parse_rendering_layout()
        if rendering_layout:
            return rendering_layout
        
        return None
    
    def _parse_rendering_layout(self) -> Optional[str]:
        """Extract Word layout from rendering section.
        
        Parses:
        rendering {
            layout(LayoutName) {
                LayoutFile = './path/to/layout.docx';
                Type = Word;
            }
        }
        """
        # Find rendering section
        rendering_match = re.search(r'rendering\s*\{', self.content, re.IGNORECASE)
        if not rendering_match:
            return None
        
        # Find the rendering block content
        rendering_start = rendering_match.end() - 1
        rendering_end = self._find_matching_brace(self.content, rendering_start)
        if rendering_end == -1:
            return None
        
        rendering_content = self.content[rendering_start + 1:rendering_end]
        
        # Find layout blocks within rendering
        layout_pattern = r'layout\s*\(\s*\w+\s*\)\s*\{'
        for layout_match in re.finditer(layout_pattern, rendering_content, re.IGNORECASE):
            # Find this layout's block
            layout_start = layout_match.end() - 1
            layout_end = self._find_matching_brace(rendering_content, layout_start)
            if layout_end == -1:
                continue
            
            layout_content = rendering_content[layout_start + 1:layout_end]
            
            # Check if this is a Word layout
            type_match = re.search(r"Type\s*=\s*Word", layout_content, re.IGNORECASE)
            if type_match:
                # Extract LayoutFile
                file_match = re.search(r"LayoutFile\s*=\s*'([^']+)'", layout_content)
                if file_match:
                    return file_match.group(1)
        
        return None
    
    def _parse_word_merge_dataitem(self) -> Optional[str]:
        """Extract WordMergeDataItem property."""
        pattern = r"WordMergeDataItem\s*=\s*(\w+)"
        match = re.search(pattern, self.content)
        if match:
            return match.group(1)
        return None
    
    def _parse_dataitems(self) -> List[DataItem]:
        """Parse all dataitems from the report using a tokenized approach."""
        dataitems = []
        
        # Find dataset section - match includes the opening brace
        dataset_match = re.search(r'dataset\s*\{', self.content, re.IGNORECASE)
        if not dataset_match:
            return dataitems
        
        # Find the closing brace of the dataset block
        dataset_start = dataset_match.end() - 1  # Position of opening {
        dataset_end = self._find_matching_brace(self.content, dataset_start)
        if dataset_end == -1:
            return dataitems
        
        # Extract just the dataset content (between braces, not including the braces)
        dataset_content = self.content[dataset_start + 1:dataset_end]
        
        # Parse dataitems hierarchically
        return self._parse_dataitems_recursive(dataset_content, None)
    
    def _parse_dataitems_recursive(self, content: str, parent: Optional[str], debug: bool = False) -> List[DataItem]:
        """Parse dataitems at the current nesting level."""
        dataitems = []
        
        # Find all dataitem declarations
        # Handles multiple formats:
        # - dataitem(Header; "Sales Header") - simple quoted
        # - dataitem(Header; Microsoft.Sales.Document."Sales Header") - namespace qualified
        # - dataitem(Line; BlendingLine006SKC) - simple unquoted
        dataitem_pattern = r'dataitem\s*\(\s*(\w+)\s*;\s*((?:[\w.]+\.)?(?:"[^"]+"|[\w]+))\s*\)'
        
        pos = 0
        while pos < len(content):
            match = re.search(dataitem_pattern, content[pos:], re.IGNORECASE)
            if not match:
                break
            
            abs_start = pos + match.start()
            name = match.group(1)
            # Extract table name, removing namespace prefix if present
            source_table_raw = match.group(2)
            # Handle namespace-qualified names like Microsoft.Sales.Document."Sales Header"
            if '."' in source_table_raw:
                # Extract the quoted part after the last dot
                source_table = source_table_raw.split('."')[-1].strip('"')
            else:
                source_table = source_table_raw.strip('"')
            
            # Find opening brace
            brace_search_start = pos + match.end()
            brace_pos = content.find('{', brace_search_start)
            if brace_pos == -1:
                pos = brace_search_start
                continue
            
            # Find matching closing brace
            end_pos = self._find_matching_brace(content, brace_pos)
            if end_pos == -1:
                pos = brace_search_start
                continue
            
            # Content inside this dataitem's braces
            inner_content = content[brace_pos + 1:end_pos]
            
            # Get line number
            line_number = self.content[:self.content.find(content[abs_start:abs_start+50])].count('\n') + 1 if abs_start < 50 else 0
            
            # Check if temporary
            is_temporary = bool(re.search(r'UseTemporary\s*=\s*true', inner_content, re.IGNORECASE))
            
            # Extract columns (only direct children, not from nested dataitems)
            columns = self._extract_direct_columns(inner_content, name)
            
            # Create dataitem
            dataitem = DataItem(
                name=name,
                source_table=source_table,
                columns=columns,
                parent=parent,
                line_number=line_number,
                is_temporary=is_temporary
            )
            
            # Recursively parse nested dataitems
            dataitem.children = self._parse_dataitems_recursive(inner_content, name, debug)
            
            dataitems.append(dataitem)
            
            # Move past this dataitem
            pos = end_pos + 1
        
        return dataitems
    
    def _extract_direct_columns(self, content: str, dataitem_name: str) -> List[Column]:
        """Extract columns that are direct children (not inside nested dataitems)."""
        columns = []
        
        # First, identify ranges that belong to nested dataitems (to exclude)
        excluded_ranges = []
        # Pattern matches namespace-qualified and simple table references
        dataitem_pattern = r'dataitem\s*\(\s*\w+\s*;\s*(?:[\w.]+\.)?(?:"[^"]+"|[\w]+)\s*\)'
        
        for di_match in re.finditer(dataitem_pattern, content, re.IGNORECASE):
            # Find the brace block after this dataitem declaration
            brace_pos = content.find('{', di_match.end())
            if brace_pos != -1:
                brace_end = self._find_matching_brace(content, brace_pos)
                if brace_end != -1:
                    excluded_ranges.append((di_match.start(), brace_end))
        
        def is_excluded(pos):
            """Check if position falls within a nested dataitem."""
            for start, end in excluded_ranges:
                if start <= pos <= end:
                    return True
            return False
        
        # Find columns using a tokenizer approach that handles nested parentheses
        # Pattern finds start of column declaration
        column_start_pattern = r'column\s*\(\s*(\w+)\s*;\s*'
        
        for match in re.finditer(column_start_pattern, content, re.IGNORECASE):
            if is_excluded(match.start()):
                continue
            
            col_name = match.group(1)
            expr_start = match.end()
            
            # Extract expression by counting parentheses
            expression = self._extract_column_expression(content, expr_start)
            if expression is None:
                continue
            
            expression = expression.strip().strip('"\'')
            
            is_label = col_name.endswith('_Lbl') or col_name.endswith('Lbl')
            
            columns.append(Column(
                name=col_name,
                expression=expression,
                dataitem=dataitem_name,
                line_number=content[:match.start()].count('\n') + 1,
                is_label=is_label
            ))
        
        return columns
    
    def _extract_column_expression(self, content: str, start: int) -> Optional[str]:
        """Extract column expression by counting parentheses.
        
        Handles nested parentheses in expressions like:
        QCDecimalFormat006SKC.FormatValue(QCPostedOrderLine006SKC."Min External", ...)
        """
        depth = 1  # We're already inside the column( opening paren
        pos = start
        
        while pos < len(content) and depth > 0:
            char = content[pos]
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
                if depth == 0:
                    # Found the closing paren of column()
                    return content[start:pos]
            pos += 1
        
        return None
    
    
    def _find_matching_brace(self, content: str, start: int) -> int:
        """Find the position of the matching closing brace.
        
        Uses simple brace counting. AL code rarely has literal braces inside strings,
        so this works for practical parsing of report definitions.
        """
        if start >= len(content) or content[start] != '{':
            return -1
        
        depth = 1
        pos = start + 1
        
        while pos < len(content) and depth > 0:
            char = content[pos]
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
            pos += 1
        
        return pos - 1 if depth == 0 else -1


def parse_al_report(file_path: Path) -> ReportSchema:
    """Convenience function to parse an AL report file."""
    parser = ALReportParser()
    return parser.parse(file_path)
