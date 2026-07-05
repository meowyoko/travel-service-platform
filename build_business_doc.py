from __future__ import annotations

import html
import math
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(r"E:\file\work\travel")
SOURCE_MD = ROOT / "疗养旅游服务平台业务流程说明_v0.2.md"
OUT_DIR = ROOT / "deliverables" / "business-process-v0.2"
SVG_DIR = OUT_DIR / "svg"
HTML_PATH = OUT_DIR / "疗养旅游服务平台业务流程说明_v0.2.html"
PDF_PATH = OUT_DIR / "疗养旅游服务平台业务流程说明_v0.2.pdf"

EDGE_CANDIDATES = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]


@dataclass
class DiagramNode:
    node_id: str
    label: str
    shape: str = "rect"
    width: int = 0
    height: int = 0
    lines: List[str] = field(default_factory=list)


@dataclass
class DiagramEdge:
    src: str
    dst: str
    label: str = ""


@dataclass
class Diagram:
    direction: str
    nodes: Dict[str, DiagramNode]
    edges: List[DiagramEdge]
    title: str


def wrap_text(text: str, max_chars: int) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    lines: List[str] = []
    current = ""
    for ch in text:
        current += ch
        if len(current) >= max_chars:
            lines.append(current)
            current = ""
    if current:
        lines.append(current)
    return lines


def measure_node(node: DiagramNode) -> None:
    max_chars = 8 if node.shape == "diamond" else 10
    node.lines = wrap_text(node.label, max_chars)
    line_count = len(node.lines)
    widest = max(len(line) for line in node.lines)
    char_width = 18 if widest <= 8 else 16
    if node.shape == "diamond":
        node.width = max(170, widest * char_width + 90)
        node.height = max(96, line_count * 26 + 58)
    else:
        node.width = max(180, widest * char_width + 52)
        node.height = max(84, line_count * 24 + 40)


def parse_node_ref(token: str, nodes: Dict[str, DiagramNode]) -> str:
    token = token.strip()
    pattern = re.compile(r"^([A-Za-z0-9_]+)(?:\[(.+)\]|\{(.+)\})?$")
    match = pattern.match(token)
    if not match:
        raise ValueError(f"无法解析节点: {token}")
    node_id, rect_label, diamond_label = match.groups()
    label = rect_label or diamond_label or node_id
    shape = "diamond" if diamond_label else "rect"
    existing = nodes.get(node_id)
    if existing:
        if rect_label or diamond_label:
            existing.label = label
            existing.shape = shape
    else:
        nodes[node_id] = DiagramNode(node_id=node_id, label=label, shape=shape)
    return node_id


def parse_mermaid(block: str, title: str) -> Diagram:
    lines = [line.rstrip() for line in block.strip().splitlines() if line.strip()]
    first = lines[0]
    direction = first.split()[1]
    nodes: Dict[str, DiagramNode] = {}
    edges: List[DiagramEdge] = []

    edge_pattern = re.compile(r"^(.*?)-->(?:\|(.*?)\|)?(.*)$")
    for raw_line in lines[1:]:
        line = raw_line.strip()
        match = edge_pattern.match(line)
        if not match:
            continue
        left, edge_label, right = match.groups()
        src = parse_node_ref(left, nodes)
        dst = parse_node_ref(right, nodes)
        edges.append(DiagramEdge(src=src, dst=dst, label=(edge_label or "").strip()))

    for node in nodes.values():
        measure_node(node)

    return Diagram(direction=direction, nodes=nodes, edges=edges, title=title)


def assign_levels(diagram: Diagram) -> Dict[str, int]:
    parents: Dict[str, List[str]] = {node_id: [] for node_id in diagram.nodes}
    indegree: Dict[str, int] = {node_id: 0 for node_id in diagram.nodes}
    for edge in diagram.edges:
        parents[edge.dst].append(edge.src)
        indegree[edge.dst] += 1

    queue = [node_id for node_id, degree in indegree.items() if degree == 0]
    levels = {node_id: 0 for node_id in queue}

    while queue:
        current = queue.pop(0)
        current_level = levels[current]
        for edge in [e for e in diagram.edges if e.src == current]:
            next_level = max(levels.get(edge.dst, 0), current_level + 1)
            levels[edge.dst] = next_level
            indegree[edge.dst] -= 1
            if indegree[edge.dst] == 0:
                queue.append(edge.dst)

    for node_id in diagram.nodes:
        levels.setdefault(node_id, 0)
    return levels


def render_svg(diagram: Diagram, path: Path) -> None:
    levels = assign_levels(diagram)
    groups: Dict[int, List[str]] = {}
    order_seen: Dict[str, int] = {}
    counter = 0
    for edge in diagram.edges:
        if edge.src not in order_seen:
            order_seen[edge.src] = counter
            counter += 1
        if edge.dst not in order_seen:
            order_seen[edge.dst] = counter
            counter += 1
    for node_id, level in levels.items():
        groups.setdefault(level, []).append(node_id)

    for level_nodes in groups.values():
        level_nodes.sort(key=lambda node_id: order_seen.get(node_id, 9999))

    gap_primary = 150
    gap_secondary = 64
    margin = 80

    positions: Dict[str, Tuple[float, float]] = {}
    max_x = 0.0
    max_y = 0.0

    if diagram.direction == "LR":
        for level, node_ids in sorted(groups.items()):
            x = margin + level * (320 + gap_primary)
            total_height = sum(diagram.nodes[node_id].height for node_id in node_ids) + max(0, len(node_ids) - 1) * gap_secondary
            y = margin + max(0, (total_height / 2))
            current_y = margin
            for node_id in node_ids:
                node = diagram.nodes[node_id]
                positions[node_id] = (x, current_y + node.height / 2)
                current_y += node.height + gap_secondary
                max_x = max(max_x, x + node.width / 2)
                max_y = max(max_y, current_y)
    else:
        for level, node_ids in sorted(groups.items()):
            y = margin + level * (170 + gap_primary)
            total_width = sum(diagram.nodes[node_id].width for node_id in node_ids) + max(0, len(node_ids) - 1) * gap_secondary
            current_x = margin
            for node_id in node_ids:
                node = diagram.nodes[node_id]
                positions[node_id] = (current_x + node.width / 2, y)
                current_x += node.width + gap_secondary
                max_x = max(max_x, current_x)
                max_y = max(max_y, y + node.height / 2)

    width = int(max_x + margin)
    height = int(max_y + margin)

    marker = """
    <defs>
      <linearGradient id="cardFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fffaf4"/>
        <stop offset="100%" stop-color="#f7efe5"/>
      </linearGradient>
      <linearGradient id="diamondFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f5ede4"/>
        <stop offset="100%" stop-color="#f0dfd0"/>
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#253143" flood-opacity="0.14"/>
      </filter>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c4f3f"/>
      </marker>
    </defs>
    """

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        marker,
        f'<rect width="{width}" height="{height}" rx="30" fill="#fcf7f1"/>',
        f'<text x="{width / 2}" y="44" text-anchor="middle" font-size="22" font-family="Microsoft YaHei UI, Noto Sans SC, sans-serif" fill="#253143" font-weight="700">{html.escape(diagram.title)}</text>',
    ]

    for edge in diagram.edges:
        src = diagram.nodes[edge.src]
        dst = diagram.nodes[edge.dst]
        src_x, src_y = positions[edge.src]
        dst_x, dst_y = positions[edge.dst]

        if diagram.direction == "LR":
            start_x = src_x + src.width / 2
            start_y = src_y
            end_x = dst_x - dst.width / 2
            end_y = dst_y
            mid_x = (start_x + end_x) / 2
            path_d = f"M {start_x} {start_y} C {mid_x} {start_y}, {mid_x} {end_y}, {end_x} {end_y}"
            label_x = mid_x
            label_y = (start_y + end_y) / 2 - 10
        else:
            start_x = src_x
            start_y = src_y + src.height / 2
            end_x = dst_x
            end_y = dst_y - dst.height / 2
            mid_y = (start_y + end_y) / 2
            path_d = f"M {start_x} {start_y} C {start_x} {mid_y}, {end_x} {mid_y}, {end_x} {end_y}"
            label_x = (start_x + end_x) / 2
            label_y = mid_y - 10

        parts.append(
            f'<path d="{path_d}" fill="none" stroke="#7c4f3f" stroke-width="3.5" marker-end="url(#arrow)" stroke-linecap="round"/>'
        )
        if edge.label:
            label_text = html.escape(edge.label)
            label_width = max(38, len(edge.label) * 18 + 24)
            parts.append(
                f'<g transform="translate({label_x - label_width / 2},{label_y - 16})">'
                f'<rect width="{label_width}" height="32" rx="16" fill="#ffffff" stroke="#d5c3b5" stroke-width="1.5"/>'
                f'<text x="{label_width / 2}" y="21" text-anchor="middle" font-size="15" font-family="Microsoft YaHei UI, Noto Sans SC, sans-serif" fill="#7c4f3f" font-weight="700">{label_text}</text>'
                f"</g>"
            )

    for node_id, node in diagram.nodes.items():
        x, y = positions[node_id]
        if node.shape == "diamond":
            hw = node.width / 2
            hh = node.height / 2
            points = f"{x},{y - hh} {x + hw},{y} {x},{y + hh} {x - hw},{y}"
            parts.append(
                f'<polygon points="{points}" fill="url(#diamondFill)" stroke="#b67a66" stroke-width="2.5" filter="url(#softShadow)"/>'
            )
        else:
            parts.append(
                f'<rect x="{x - node.width / 2}" y="{y - node.height / 2}" width="{node.width}" height="{node.height}" rx="22" fill="url(#cardFill)" stroke="#d7c4b2" stroke-width="2" filter="url(#softShadow)"/>'
            )

        text_y = y - ((len(node.lines) - 1) * 12)
        for index, line in enumerate(node.lines):
            parts.append(
                f'<text x="{x}" y="{text_y + index * 24}" text-anchor="middle" dominant-baseline="middle" font-size="18" font-family="Microsoft YaHei UI, Noto Sans SC, sans-serif" fill="#253143" font-weight="600">{html.escape(line)}</text>'
            )

    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def extract_mermaid_blocks(content: str) -> Tuple[str, List[Tuple[str, str]]]:
    blocks: List[Tuple[str, str]] = []

    def repl(match: re.Match[str]) -> str:
        idx = len(blocks) + 1
        block = match.group(1).strip()
        placeholder = f"[[[DIAGRAM_{idx}]]]"
        blocks.append((placeholder, block))
        return placeholder

    text = re.sub(r"```mermaid\s*(.*?)```", repl, content, flags=re.S)
    return text, blocks


def markdown_inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r'"(.+?)"', r"<span class=\"quote\">\1</span>", text)
    return text


def render_markdown_to_html(content: str, placeholder_to_svg: Dict[str, str]) -> Tuple[str, List[Tuple[str, str]]]:
    lines = content.splitlines()
    body_parts: List[str] = []
    toc: List[Tuple[str, str]] = []
    in_list = False
    in_ol = False
    paragraph_buffer: List[str] = []
    current_h2_count = 0
    pending_callout: List[str] = []
    section_open = False

    def flush_paragraph() -> None:
        nonlocal paragraph_buffer, pending_callout
        if paragraph_buffer:
            text = " ".join(part.strip() for part in paragraph_buffer).strip()
            if text:
                body_parts.append(f"<p>{markdown_inline(text)}</p>")
            paragraph_buffer = []
        if pending_callout:
            items = "".join(f"<li>{markdown_inline(item)}</li>" for item in pending_callout)
            body_parts.append(f'<div class="callout"><div class="callout-title">要点</div><ul>{items}</ul></div>')
            pending_callout = []

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped.startswith("## "):
            flush_paragraph()
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            if in_ol:
                body_parts.append("</ol>")
                in_ol = False
            if section_open:
                body_parts.append("</section>")
            current_h2_count += 1
            title = stripped[3:].strip()
            anchor = f"section-{current_h2_count}"
            toc.append((anchor, title))
            body_parts.append(f'<section class="chapter" id="{anchor}">')
            body_parts.append(f'<div class="chapter-kicker">Section {current_h2_count:02d}</div>')
            body_parts.append(f"<h2>{markdown_inline(title)}</h2>")
            section_open = True
            continue

        if stripped == "---":
            flush_paragraph()
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            if in_ol:
                body_parts.append("</ol>")
                in_ol = False
            body_parts.append('<div class="divider"></div>')
            continue

        if stripped in placeholder_to_svg:
            flush_paragraph()
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            if in_ol:
                body_parts.append("</ol>")
                in_ol = False
            svg_rel = placeholder_to_svg[stripped]
            body_parts.append(
                f'<figure class="diagram-card"><img src="{svg_rel}" alt="流程图"/><figcaption>流程图重绘版</figcaption></figure>'
            )
            continue

        if re.match(r"^\d+\.\s", stripped):
            flush_paragraph()
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            if not in_ol:
                body_parts.append('<ol class="number-list">')
                in_ol = True
            item = re.sub(r"^\d+\.\s*", "", stripped)
            body_parts.append(f"<li>{markdown_inline(item)}</li>")
            continue

        if stripped.startswith("- "):
            if paragraph_buffer:
                paragraph_text = " ".join(part.strip() for part in paragraph_buffer).strip()
                if paragraph_text.endswith("说明："):
                    pending_callout.append(stripped[2:].strip())
                    paragraph_buffer = []
                    continue
            flush_paragraph()
            if in_ol:
                body_parts.append("</ol>")
                in_ol = False
            if not in_list:
                body_parts.append('<ul class="bullet-list">')
                in_list = True
            body_parts.append(f"<li>{markdown_inline(stripped[2:].strip())}</li>")
            continue

        if not stripped:
            flush_paragraph()
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            if in_ol:
                body_parts.append("</ol>")
                in_ol = False
            continue

        if in_list:
            body_parts.append("</ul>")
            in_list = False
        if in_ol:
            body_parts.append("</ol>")
            in_ol = False

        paragraph_buffer.append(stripped)

    flush_paragraph()
    if in_list:
        body_parts.append("</ul>")
    if in_ol:
        body_parts.append("</ol>")
    if section_open:
        body_parts.append("</section>")

    rendered = "\n".join(body_parts)
    return rendered, toc


def build_html(title: str, content_html: str, toc: List[Tuple[str, str]]) -> str:
    toc_items = "\n".join(
        f'<li><a href="#{anchor}"><span>{index:02d}</span><strong>{html.escape(name)}</strong></a></li>'
        for index, (anchor, name) in enumerate(toc, start=1)
    )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --color-bg-primary: #fcf7f1;
      --color-bg-secondary: #f7efe5;
      --color-surface: rgba(255, 250, 244, 0.92);
      --color-border: #dac7b6;
      --color-text: #253143;
      --color-muted: #667085;
      --color-accent: #8b5b48;
      --color-accent-soft: #ead9c8;
      --color-line: linear-gradient(90deg, rgba(139, 91, 72, 0), rgba(139, 91, 72, 0.85), rgba(37, 49, 67, 0));
      --shadow-soft: 0 18px 40px rgba(37, 49, 67, 0.08);
      --shadow-card: 0 12px 28px rgba(37, 49, 67, 0.10);
      --radius-lg: 24px;
      --radius-md: 16px;
      --radius-pill: 999px;
    }}

    @page {{
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }}

    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      font-family: "Noto Sans SC", "Microsoft YaHei UI", sans-serif;
      background:
        radial-gradient(circle at top right, rgba(139, 91, 72, 0.10), transparent 28%),
        linear-gradient(180deg, #fffaf4 0%, #fbf5ee 55%, #f8f0e6 100%);
      color: var(--color-text);
      line-height: 1.72;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    .page {{
      max-width: 980px;
      margin: 0 auto;
      padding: 28px 16px 42px;
    }}

    .cover {{
      min-height: 92vh;
      display: grid;
      grid-template-rows: 1fr auto;
      padding: 20px 4px 12px;
    }}

    .cover-card {{
      background: linear-gradient(145deg, rgba(255, 250, 244, 0.96), rgba(247, 239, 229, 0.96));
      border: 1px solid rgba(218, 199, 182, 0.75);
      border-radius: 34px;
      box-shadow: var(--shadow-soft);
      padding: 44px 42px 38px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }}

    .cover-card::before {{
      content: "";
      position: absolute;
      inset: -120px -80px auto auto;
      width: 360px;
      height: 360px;
      background: radial-gradient(circle, rgba(139, 91, 72, 0.16), transparent 68%);
      pointer-events: none;
    }}

    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border: 1px solid rgba(139, 91, 72, 0.18);
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.62);
      color: var(--color-accent);
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      width: fit-content;
    }}

    .cover h1 {{
      margin: 26px 0 16px;
      font-family: "Noto Serif SC", "Source Han Serif SC", serif;
      font-size: 34px;
      line-height: 1.3;
      letter-spacing: 0.02em;
    }}

    .cover-lead {{
      max-width: 720px;
      font-size: 16px;
      color: var(--color-muted);
    }}

    .meta-strip {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 34px;
    }}

    .meta-card {{
      padding: 18px 18px 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid rgba(218, 199, 182, 0.75);
    }}

    .meta-card span {{
      display: block;
      font-size: 12px;
      letter-spacing: 0.06em;
      color: var(--color-muted);
      text-transform: uppercase;
    }}

    .meta-card strong {{
      display: block;
      margin-top: 10px;
      font-size: 18px;
      line-height: 1.45;
    }}

    .toc-card {{
      margin-top: 24px;
      padding: 28px 28px 22px;
      border-radius: 30px;
      background: rgba(255, 250, 244, 0.86);
      border: 1px solid rgba(218, 199, 182, 0.75);
      box-shadow: var(--shadow-card);
      break-after: page;
    }}

    .toc-card h2 {{
      margin: 0 0 20px;
      font-family: "Noto Serif SC", "Source Han Serif SC", serif;
      font-size: 26px;
    }}

    .toc-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 18px;
    }}

    .toc-grid ul {{
      margin: 0;
      padding: 0;
      list-style: none;
    }}

    .toc-grid li a {{
      text-decoration: none;
      color: var(--color-text);
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.76);
      border: 1px solid rgba(218, 199, 182, 0.55);
    }}

    .toc-grid li span {{
      color: var(--color-accent);
      font-size: 13px;
      min-width: 24px;
    }}

    .chapter {{
      margin: 0 0 26px;
      padding: 32px 28px 28px;
      border-radius: 28px;
      background: rgba(255, 250, 244, 0.84);
      border: 1px solid rgba(218, 199, 182, 0.72);
      box-shadow: var(--shadow-card);
      break-inside: avoid;
    }}

    .chapter + .chapter {{
      margin-top: 22px;
    }}

    .chapter-kicker {{
      color: var(--color-accent);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }}

    h2 {{
      margin: 0 0 18px;
      font-family: "Noto Serif SC", "Source Han Serif SC", serif;
      font-size: 27px;
      line-height: 1.35;
    }}

    p {{
      margin: 0 0 14px;
      color: var(--color-text);
      font-size: 15px;
    }}

    .divider {{
      height: 1px;
      margin: 24px 0;
      background: var(--color-line);
    }}

    .diagram-card {{
      margin: 22px 0 14px;
      padding: 18px 18px 12px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(218, 199, 182, 0.7);
      box-shadow: var(--shadow-soft);
      break-inside: avoid;
    }}

    .diagram-card img {{
      display: block;
      width: 100%;
      height: auto;
      border-radius: 20px;
    }}

    .diagram-card figcaption {{
      text-align: center;
      margin-top: 12px;
      color: var(--color-muted);
      font-size: 13px;
    }}

    .number-list,
    .bullet-list {{
      margin: 8px 0 14px 0;
      padding-left: 22px;
    }}

    .number-list li,
    .bullet-list li {{
      margin-bottom: 8px;
      font-size: 15px;
    }}

    .callout {{
      margin: 18px 0 14px;
      padding: 16px 18px 12px;
      border-left: 4px solid var(--color-accent);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(234, 217, 200, 0.56), rgba(255, 250, 244, 0.8));
    }}

    .callout-title {{
      font-size: 13px;
      color: var(--color-accent);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
      font-weight: 700;
    }}

    .callout ul {{
      margin: 0;
      padding-left: 18px;
    }}

    .quote {{
      color: var(--color-accent);
    }}

    .footer-note {{
      margin-top: 26px;
      padding: 18px 20px;
      color: var(--color-muted);
      font-size: 13px;
      text-align: center;
    }}

    @media print {{
      .page {{
        padding: 0;
      }}
      .cover {{
        min-height: auto;
      }}
    }}
  </style>
</head>
<body>
  <div class="page">
    <section class="cover">
      <div class="cover-card">
        <div>
          <div class="eyebrow">Business Process Booklet</div>
          <h1>{html.escape(title)}</h1>
          <p class="cover-lead">这是一份针对疗养旅游服务平台第一阶段业务模式的视觉化说明稿。内容包括平台定位、账号关系、个人疗养、团体项目、额度使用与服务方案展示逻辑，并将原始流程图重绘为统一风格的高质量图示。</p>
          <div class="meta-strip">
            <div class="meta-card">
              <span>Document Type</span>
              <strong>业务流程说明书</strong>
            </div>
            <div class="meta-card">
              <span>Version</span>
              <strong>v0.2</strong>
            </div>
            <div class="meta-card">
              <span>Output</span>
              <strong>版式重排 + SVG 流程图</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-note">Prepared in a warm editorial style for internal review and presentation.</div>
    </section>

    <section class="toc-card">
      <h2>目录</h2>
      <div class="toc-grid">
        <ul>{toc_items}</ul>
      </div>
    </section>

    {content_html}
  </div>
</body>
</html>
"""


def locate_edge() -> Path | None:
    for candidate in EDGE_CANDIDATES:
        if candidate.exists():
            return candidate
    return shutil.which("msedge") and Path(str(shutil.which("msedge")))


def export_pdf(html_path: Path, pdf_path: Path) -> None:
    edge_path = locate_edge()
    if edge_path is None:
        raise FileNotFoundError("未找到 Edge，无法导出 PDF。")

    cmd = [
        str(edge_path),
        "--headless",
        "--disable-gpu",
        "--print-to-pdf=" + str(pdf_path),
        "--no-pdf-header-footer",
        html_path.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SVG_DIR.mkdir(parents=True, exist_ok=True)

    content = SOURCE_MD.read_text(encoding="utf-8")
    title_match = re.search(r"^#\s+(.+)$", content, flags=re.M)
    title = title_match.group(1).strip() if title_match else "业务流程说明"

    content_without_title = re.sub(r"^#\s+.+?$", "", content, count=1, flags=re.M).strip()
    text_with_placeholders, blocks = extract_mermaid_blocks(content_without_title)

    diagram_titles = [
        "整体业务流程",
        "集团与员工账号",
        "个人疗养服务",
        "意向提交规则",
        "集团团体项目",
        "个人订单与团体项目的区别",
        "额度使用逻辑",
        "服务方案展示逻辑",
    ]

    placeholder_to_svg: Dict[str, str] = {}
    for index, (placeholder, block) in enumerate(blocks, start=1):
        title_for_diagram = diagram_titles[index - 1] if index - 1 < len(diagram_titles) else f"流程图 {index}"
        diagram = parse_mermaid(block, title_for_diagram)
        svg_path = SVG_DIR / f"diagram-{index:02d}.svg"
        render_svg(diagram, svg_path)
        placeholder_to_svg[placeholder] = f"svg/{svg_path.name}"

    content_html, toc = render_markdown_to_html(text_with_placeholders, placeholder_to_svg)
    full_html = build_html(title, content_html, toc)
    HTML_PATH.write_text(full_html, encoding="utf-8")
    export_pdf(HTML_PATH, PDF_PATH)

    print(f"HTML generated: {HTML_PATH}")
    print(f"PDF generated: {PDF_PATH}")


if __name__ == "__main__":
    main()
