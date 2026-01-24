"""
DOCX Layout Analyzer - Extracts content controls and data bindings from Word layouts.
"""

import zipfile
import os
from pathlib import Path
from typing import List, Optional
from xml.dom import minidom
import defusedxml.minidom as safe_minidom
from .models import LayoutSchema, ContentControl, RepeatingSection


class DocxLayoutAnalyzer:
    """Analyzer for Business Central Word report layouts."""
    
    # XML namespaces used in Word documents
    NAMESPACES = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
        'w15': 'http://schemas.microsoft.com/office/word/2012/wordml',
        'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    }
    
    def __init__(self):
        self.temp_dir: Optional[Path] = None
        self.document_xml: Optional[minidom.Document] = None
        
    def analyze(self, file_path: Path) -> LayoutSchema:
        """Analyze a Word layout file and return its schema."""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Layout file not found: {file_path}")
        
        if not file_path.suffix.lower() == '.docx':
            raise ValueError(f"Expected .docx file, got: {file_path.suffix}")
        
        content_controls = []
        repeating_sections = []
        custom_xml_parts = []
        
        with zipfile.ZipFile(file_path, 'r') as zf:
            # Read document.xml
            if 'word/document.xml' in zf.namelist():
                with zf.open('word/document.xml') as f:
                    self.document_xml = safe_minidom.parse(f)
                    content_controls = self._extract_content_controls()
                    repeating_sections = self._extract_repeating_sections()
            
            # Read custom XML parts
            custom_xml_parts = self._extract_custom_xml_parts(zf)
        
        return LayoutSchema(
            file_path=file_path,
            content_controls=content_controls,
            repeating_sections=repeating_sections,
            custom_xml_parts=custom_xml_parts
        )
    
    def _extract_content_controls(self) -> List[ContentControl]:
        """Extract all content controls (SDT elements) from document."""
        controls = []
        
        if not self.document_xml:
            return controls
        
        # Find all structured document tags (w:sdt)
        sdt_elements = self.document_xml.getElementsByTagName('w:sdt')
        
        for sdt in sdt_elements:
            control = self._parse_sdt_element(sdt)
            if control:
                controls.append(control)
        
        return controls
    
    def _parse_sdt_element(self, sdt) -> Optional[ContentControl]:
        """Parse a single SDT element into a ContentControl."""
        # Get SDT properties
        sdt_pr = self._get_child(sdt, 'w:sdtPr')
        if not sdt_pr:
            return None
        
        # Extract tag
        tag_elem = self._get_child(sdt_pr, 'w:tag')
        tag = tag_elem.getAttribute('w:val') if tag_elem else ""
        
        # Extract alias
        alias_elem = self._get_child(sdt_pr, 'w:alias')
        alias = alias_elem.getAttribute('w:val') if alias_elem else None
        
        # Extract data binding
        binding_elem = self._get_child(sdt_pr, 'w:dataBinding')
        binding = None
        if binding_elem:
            binding = binding_elem.getAttribute('w:xpath')
        
        # Determine control type
        control_type = self._determine_control_type(sdt_pr)
        
        # Check if in repeating section
        in_repeating = self._find_parent_repeating_section(sdt)
        
        return ContentControl(
            tag=tag,
            alias=alias,
            binding=binding,
            control_type=control_type,
            in_repeating_section=in_repeating
        )
    
    def _determine_control_type(self, sdt_pr) -> str:
        """Determine the type of content control."""
        type_elements = [
            ('w:text', 'text'),
            ('w:richText', 'richtext'),
            ('w:picture', 'picture'),
            ('w:dropDownList', 'dropdown'),
            ('w:comboBox', 'combobox'),
            ('w:date', 'date'),
            ('w:checkbox', 'checkbox'),
            ('w15:repeatingSection', 'repeating'),
            ('w15:repeatingSectionItem', 'repeating_item'),
        ]
        
        for elem_name, type_name in type_elements:
            if self._get_child(sdt_pr, elem_name):
                return type_name
        
        return 'text'  # Default
    
    def _extract_repeating_sections(self) -> List[RepeatingSection]:
        """Extract repeating sections from document."""
        sections = []
        
        if not self.document_xml:
            return sections
        
        # Find repeating section content controls
        sdt_elements = self.document_xml.getElementsByTagName('w:sdt')
        
        for sdt in sdt_elements:
            sdt_pr = self._get_child(sdt, 'w:sdtPr')
            if not sdt_pr:
                continue
            
            # Check if this is a repeating section
            if self._get_child(sdt_pr, 'w15:repeatingSection'):
                section = self._parse_repeating_section(sdt)
                if section:
                    sections.append(section)
        
        return sections
    
    def _parse_repeating_section(self, sdt) -> Optional[RepeatingSection]:
        """Parse a repeating section SDT element."""
        sdt_pr = self._get_child(sdt, 'w:sdtPr')
        if not sdt_pr:
            return None
        
        # Get tag/name
        tag_elem = self._get_child(sdt_pr, 'w:tag')
        name = tag_elem.getAttribute('w:val') if tag_elem else "unnamed"
        
        # Get binding
        binding_elem = self._get_child(sdt_pr, 'w:dataBinding')
        binding = binding_elem.getAttribute('w:xpath') if binding_elem else None
        
        # Get controls within this section
        controls = []
        nested_sdts = sdt.getElementsByTagName('w:sdt')
        for nested in nested_sdts:
            if nested != sdt:  # Skip self
                control = self._parse_sdt_element(nested)
                if control:
                    controls.append(control)
        
        return RepeatingSection(
            name=name,
            binding=binding,
            controls=controls
        )
    
    def _extract_custom_xml_parts(self, zf: zipfile.ZipFile) -> List[str]:
        """Extract custom XML part names from the docx."""
        parts = []
        
        for name in zf.namelist():
            if name.startswith('customXml/') and name.endswith('.xml'):
                parts.append(name)
        
        return parts
    
    def _find_parent_repeating_section(self, element) -> Optional[str]:
        """Find if element is inside a repeating section."""
        parent = element.parentNode
        while parent:
            if parent.nodeName == 'w:sdt':
                sdt_pr = self._get_child(parent, 'w:sdtPr')
                if sdt_pr and self._get_child(sdt_pr, 'w15:repeatingSection'):
                    tag_elem = self._get_child(sdt_pr, 'w:tag')
                    return tag_elem.getAttribute('w:val') if tag_elem else "unnamed"
            parent = parent.parentNode
        return None
    
    def _get_child(self, element, tag_name: str):
        """Get first child element with given tag name."""
        for child in element.childNodes:
            if child.nodeName == tag_name:
                return child
        return None


def analyze_layout(file_path: Path) -> LayoutSchema:
    """Convenience function to analyze a Word layout file."""
    analyzer = DocxLayoutAnalyzer()
    return analyzer.analyze(file_path)
