#!/usr/bin/env python3
"""
Convert Markdown report to styled Microsoft Word document (.docx)
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def set_cell_background(cell, color_hex):
    """Đặt màu nền cho ô trong bảng."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tcPr.append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Đặt padding cho ô."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def add_formatted_text(p, text):
    """Xử lý in đậm, in nghiêng, inline code trong đoạn văn."""
    # Tách các token
    tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**') and len(token) >= 4:
            run = p.add_run(token[2:-2])
            run.bold = True
        elif token.startswith('*') and token.endswith('*') and len(token) >= 2:
            run = p.add_run(token[1:-1])
            run.italic = True
        elif token.startswith('`') and token.endswith('`') and len(token) >= 2:
            run = p.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(199, 37, 78)
        else:
            p.add_run(token)


def convert_markdown_to_docx(md_path, docx_path):
    print(f"Reading Markdown from: {md_path}")
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    doc = docx.Document()

    # Thiết lập lề trang chuẩn (A4)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Base style
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Arial'
    font.size = Pt(10.5)
    font.color.rgb = RGBColor(30, 41, 59)

    i = 0
    in_code_block = False
    code_block_lines = []
    
    while i < len(lines):
        line = lines[i].rstrip('\r\n')

        # Code block handling
        if line.startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_block_lines = []
            else:
                in_code_block = False
                # Thêm bảng chứa code
                code_text = '\n'.join(code_block_lines)
                table = doc.add_table(rows=1, cols=1)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell = table.cell(0, 0)
                set_cell_background(cell, 'F1F5F9')
                set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
                cp = cell.paragraphs[0]
                cp.paragraph_format.space_before = Pt(0)
                cp.paragraph_format.space_after = Pt(0)
                c_run = cp.add_run(code_text)
                c_run.font.name = 'Consolas'
                c_run.font.size = Pt(9)
                c_run.font.color.rgb = RGBColor(15, 23, 42)
                doc.add_paragraph()  # khoảng cách sau bảng
            i += 1
            continue

        if in_code_block:
            code_block_lines.append(line)
            i += 1
            continue

        # Markdown Table handling
        if '|' in line and not line.strip().startswith('>'):
            # Kiểm tra xem có phải dòng bảng không
            table_lines = []
            while i < len(lines) and '|' in lines[i] and lines[i].strip():
                table_lines.append(lines[i].strip())
                i += 1
            
            if len(table_lines) >= 2:
                # Parse bảng
                header_raw = [c.strip() for c in table_lines[0].split('|')[1:-1]]
                num_cols = len(header_raw)
                # Bỏ dòng ngăn cách |---|---|
                data_rows = []
                for row_line in table_lines[2:]:
                    cells = [c.strip() for c in row_line.split('|')[1:-1]]
                    if len(cells) < num_cols:
                        cells.extend([''] * (num_cols - len(cells)))
                    data_rows.append(cells[:num_cols])

                table = doc.add_table(rows=len(data_rows) + 1, cols=num_cols)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                table.autofit = True

                # Header
                hdr_cells = table.rows[0].cells
                for idx, text in enumerate(header_raw):
                    hdr_cells[idx].text = ''
                    p = hdr_cells[idx].paragraphs[0]
                    p.paragraph_format.space_before = Pt(4)
                    p.paragraph_format.space_after = Pt(4)
                    run = p.add_run(text)
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.size = Pt(10)
                    set_cell_background(hdr_cells[idx], '1E3A8A')
                    set_cell_margins(hdr_cells[idx], top=100, bottom=100, left=120, right=120)

                # Data rows
                for r_idx, row_data in enumerate(data_rows):
                    row_cells = table.rows[r_idx + 1].cells
                    bg_col = 'F8FAFC' if r_idx % 2 == 1 else 'FFFFFF'
                    for c_idx, cell_value in enumerate(row_data):
                        row_cells[c_idx].text = ''
                        p = row_cells[c_idx].paragraphs[0]
                        p.paragraph_format.space_before = Pt(3)
                        p.paragraph_format.space_after = Pt(3)
                        add_formatted_text(p, cell_value)
                        set_cell_background(row_cells[c_idx], bg_col)
                        set_cell_margins(row_cells[c_idx], top=80, bottom=80, left=120, right=120)

                doc.add_paragraph()  # khoảng cách
                continue
            else:
                # Không phải bảng hợp lệ
                pass

        stripped = line.strip()

        # Đường kẻ ngang
        if stripped in ('---', '***', '___'):
            i += 1
            continue

        # Tiêu đề chính H1
        if line.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(line[2:].strip())
            run.bold = True
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(30, 58, 138)  # Navy
        # H2
        elif line.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(5)
            run = p.add_run(line[3:].strip())
            run.bold = True
            run.font.size = Pt(14)
            run.font.color.rgb = RGBColor(14, 116, 144)  # Cyan
        # H3
        elif line.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(line[4:].strip())
            run.bold = True
            run.font.size = Pt(12)
            run.font.color.rgb = RGBColor(30, 41, 59)
        # H4
        elif line.startswith('#### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(line[5:].strip())
            run.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(51, 65, 85)
        # Blockquote >
        elif line.startswith('> '):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            add_formatted_text(p, line[2:].strip())
            for r in p.runs:
                r.italic = True
                r.font.color.rgb = RGBColor(71, 85, 105)
        # Bullet list * hoặc -
        elif re.match(r'^\s*[\*\-]\s+', line):
            indent_level = len(re.match(r'^\s*', line).group(0)) // 2
            text = re.sub(r'^\s*[\*\-]\s+', '', line)
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.left_indent = Inches(0.25 * (indent_level + 1))
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_text(p, text)
        # Numbered list
        elif re.match(r'^\s*\d+\.\s+', line):
            text = re.sub(r'^\s*\d+\.\s+', '', line)
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_text(p, text)
        # Normal text
        elif stripped:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(4)
            add_formatted_text(p, stripped)

        i += 1

    doc.save(docx_path)
    print(f"Successfully generated DOCX at: {docx_path}")


if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root_dir = os.path.dirname(base_dir)
    md_file = os.path.join(root_dir, "BAO_CAO_TONG_HOP_GIAI_DAU_VA_HE_THONG_OTTV2.md")
    docx_file = os.path.join(root_dir, "BAO_CAO_TONG_HOP_GIAI_DAU_VA_HE_THONG_OTTV2.docx")
    convert_markdown_to_docx(md_file, docx_file)
