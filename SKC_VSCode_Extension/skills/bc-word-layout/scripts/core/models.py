"""
Data models for BC Word Layout analysis.
Typed dataclasses for report schemas, layout schemas, and validation results.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from pathlib import Path


class Severity(Enum):
    """Validation issue severity levels."""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class Column:
    """Represents a column definition in an AL report."""
    name: str
    expression: str
    dataitem: str
    line_number: int
    is_label: bool = False
    
    @property
    def display_name(self) -> str:
        """Column name without dataitem prefix."""
        return self.name
    
    def __str__(self) -> str:
        return f"{self.name} = {self.expression}"


@dataclass
class DataItem:
    """Represents a dataitem block in an AL report."""
    name: str
    source_table: str
    columns: List[Column] = field(default_factory=list)
    children: List['DataItem'] = field(default_factory=list)
    parent: Optional[str] = None
    line_number: int = 0
    is_temporary: bool = False
    
    @property
    def column_count(self) -> int:
        return len(self.columns)
    
    @property
    def total_column_count(self) -> int:
        """Total columns including children."""
        total = len(self.columns)
        for child in self.children:
            total += child.total_column_count
        return total
    
    def get_column(self, name: str) -> Optional[Column]:
        """Find column by name."""
        for col in self.columns:
            if col.name.lower() == name.lower():
                return col
        return None
    
    def __str__(self) -> str:
        return f"{self.name} ({self.source_table}) - {self.column_count} columns"


@dataclass
class ReportSchema:
    """Complete schema of an AL report."""
    report_id: int
    report_name: str
    caption: str
    file_path: Path
    word_layout: Optional[str] = None
    word_merge_dataitem: Optional[str] = None
    dataitems: List[DataItem] = field(default_factory=list)
    
    @property
    def total_columns(self) -> int:
        """Total columns across all dataitems."""
        return sum(di.total_column_count for di in self.dataitems)
    
    def get_dataitem(self, name: str) -> Optional[DataItem]:
        """Find dataitem by name (searches recursively)."""
        def search(items: List[DataItem]) -> Optional[DataItem]:
            for item in items:
                if item.name.lower() == name.lower():
                    return item
                found = search(item.children)
                if found:
                    return found
            return None
        return search(self.dataitems)
    
    def get_all_columns(self) -> List[Column]:
        """Get all columns from all dataitems."""
        columns = []
        def collect(items: List[DataItem]):
            for item in items:
                columns.extend(item.columns)
                collect(item.children)
        collect(self.dataitems)
        return columns
    
    def get_column_names(self) -> set:
        """Get set of all column names."""
        return {col.name for col in self.get_all_columns()}
    
    def __str__(self) -> str:
        return f"Report {self.report_id} '{self.report_name}' - {len(self.dataitems)} dataitems, {self.total_columns} columns"


@dataclass
class ContentControl:
    """Represents a content control in a Word layout."""
    tag: str
    alias: Optional[str] = None
    binding: Optional[str] = None
    control_type: str = "text"
    location: str = ""
    line_number: int = 0
    in_repeating_section: Optional[str] = None
    
    def __str__(self) -> str:
        return f"{self.tag} ({self.control_type})"


@dataclass
class RepeatingSection:
    """Represents a repeating section in a Word layout."""
    name: str
    binding: Optional[str] = None
    controls: List[ContentControl] = field(default_factory=list)
    children: List['RepeatingSection'] = field(default_factory=list)
    
    def __str__(self) -> str:
        return f"{self.name} - {len(self.controls)} controls"


@dataclass
class LayoutSchema:
    """Complete schema of a Word layout."""
    file_path: Path
    content_controls: List[ContentControl] = field(default_factory=list)
    repeating_sections: List[RepeatingSection] = field(default_factory=list)
    custom_xml_parts: List[str] = field(default_factory=list)
    
    @property
    def total_controls(self) -> int:
        return len(self.content_controls)
    
    def get_control_tags(self) -> set:
        """Get set of all content control tags."""
        return {cc.tag for cc in self.content_controls if cc.tag}
    
    def get_field_names(self) -> set:
        """Get set of actual field names from BC path-based tags.
        
        BC layouts use paths like '/Header/FieldName' in the alias.
        This extracts the last component as the field name.
        """
        fields = set()
        for cc in self.content_controls:
            field_name = self._extract_field_name(cc.tag, cc.alias)
            if field_name:
                fields.add(field_name)
        return fields
    
    @staticmethod
    def _extract_field_name(tag: str, alias: str) -> str:
        """Extract field name from BC layout tag/alias path."""
        # Try alias first (more specific)
        if alias and '/' in alias:
            parts = alias.rstrip('/').split('/')
            if parts:
                return parts[-1]
        # Fall back to tag
        if tag and '/' in tag:
            parts = tag.rstrip('/').split('/')
            if parts:
                return parts[-1]
        return tag or ""
    
    def __str__(self) -> str:
        return f"Layout '{self.file_path.name}' - {self.total_controls} content controls"


@dataclass
class ValidationIssue:
    """A single validation issue."""
    severity: Severity
    code: str
    message: str
    field: Optional[str] = None
    suggestion: Optional[str] = None
    line_number: Optional[int] = None
    
    @property
    def icon(self) -> str:
        """Get icon for severity level."""
        icons = {
            Severity.ERROR: "✗",
            Severity.WARNING: "⚠",
            Severity.INFO: "ℹ"
        }
        return icons.get(self.severity, "•")
    
    def __str__(self) -> str:
        prefix = f"[{self.severity.value.upper()}]"
        msg = f"{prefix} {self.message}"
        if self.suggestion:
            msg += f" → {self.suggestion}"
        return msg


@dataclass
class ValidationResult:
    """Complete validation result."""
    report_schema: ReportSchema
    layout_schema: LayoutSchema
    issues: List[ValidationIssue] = field(default_factory=list)
    
    @property
    def is_valid(self) -> bool:
        """True if no errors (warnings/info allowed)."""
        return not any(i.severity == Severity.ERROR for i in self.issues)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.WARNING)
    
    @property
    def info_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.INFO)
    
    @property
    def matched_fields(self) -> int:
        """Number of layout fields that matched report columns."""
        report_cols_lower = {c.lower() for c in self.report_schema.get_column_names()}
        layout_fields_lower = {f.lower() for f in self.layout_schema.get_field_names()}
        return len(report_cols_lower & layout_fields_lower)
    
    def get_errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.ERROR]
    
    def get_warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.WARNING]
    
    def __str__(self) -> str:
        status = "PASS" if self.is_valid else "FAIL"
        return f"Validation {status}: {self.error_count} errors, {self.warning_count} warnings, {self.info_count} info"
