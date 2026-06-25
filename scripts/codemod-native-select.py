#!/usr/bin/env python3
"""
Codemod: native <select> → shadcn <Select>.

Handles JSX brace-aware scanning so arrow-function bodies like
`onChange={(e) => setX(e.target.value)}` don't confuse the parser.

The conservative scan:
  1. Find every '<select' substring (case-sensitive).
  2. Walk forward to the matching '>' that ends the OPEN tag, respecting
     {...} nesting depth.
  3. From there, scan forward to '</select>' to capture the body.
  4. Build the replacement using the parsed attributes + transformed
     <option> children.

Usage:
  python3 scripts/codemod-native-select.py file1 file2 …
"""
import re
import sys
import os


def find_open_tag_end(text, start):
    """Given index of '<' in '<select', return the index AFTER the '>' that
    ends the opening tag, accounting for { nesting inside attribute values."""
    i = start
    depth = 0
    in_string = None  # ' or " when inside quoted attribute value
    n = len(text)
    while i < n:
        c = text[i]
        if in_string:
            if c == in_string and text[i - 1] != '\\':
                in_string = None
            i += 1
            continue
        if c == '"' or c == "'":
            in_string = c
            i += 1
            continue
        if c == '{':
            depth += 1
            i += 1
            continue
        if c == '}':
            depth -= 1
            i += 1
            continue
        if c == '>' and depth == 0:
            return i + 1
        i += 1
    return -1


ATTR_RE = re.compile(r'(\w+)\s*=\s*(?:"([^"]*)"|\{(.+?)\}(?=\s|/?>|$))', re.DOTALL)


def parse_attrs(attrs_str):
    """Best-effort attribute parser. Treats `{...}` greedily by counting
    braces, so arrow-function bodies stay intact."""
    out = {}
    i = 0
    n = len(attrs_str)
    while i < n:
        # Skip whitespace
        while i < n and attrs_str[i].isspace():
            i += 1
        if i >= n:
            break
        # Parse identifier
        start = i
        while i < n and (attrs_str[i].isalnum() or attrs_str[i] in '_-'):
            i += 1
        if i == start:
            i += 1
            continue
        name = attrs_str[start:i]
        # Expect '='
        while i < n and attrs_str[i].isspace():
            i += 1
        if i >= n or attrs_str[i] != '=':
            # Boolean attr (e.g. `disabled`) — record and move on
            out[name] = ('bare', True)
            continue
        i += 1  # skip '='
        while i < n and attrs_str[i].isspace():
            i += 1
        if i >= n:
            break
        if attrs_str[i] == '"':
            # quoted string
            end = attrs_str.index('"', i + 1)
            out[name] = ('string', attrs_str[i + 1:end])
            i = end + 1
        elif attrs_str[i] == '{':
            # JSX expression — count braces
            depth = 1
            j = i + 1
            in_str = None
            while j < n and depth > 0:
                ch = attrs_str[j]
                if in_str:
                    if ch == in_str and attrs_str[j - 1] != '\\':
                        in_str = None
                elif ch in '"\'`':
                    in_str = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                j += 1
            out[name] = ('expr', attrs_str[i + 1:j - 1].strip())
            i = j
        else:
            # Unknown shape — skip token
            while i < n and not attrs_str[i].isspace():
                i += 1
    return out


OPTION_RE = re.compile(
    r'<option\b([^>]*?)>(.*?)</option>',
    re.DOTALL,
)


def transform_onchange(expr):
    """Translate (e) => f(e.target.value) → (v) => f(String(v))."""
    expr = expr.replace('e.target.value', 'String(v)')
    expr = expr.replace('event.target.value', 'String(v)')
    expr = re.sub(r'^\(\s*e\s*\)\s*=>', '(v) =>', expr)
    expr = re.sub(r'^\s*e\s*=>', '(v) =>', expr)
    return expr


def find_option_tag_end(text, start):
    """Same as find_open_tag_end but for <option>."""
    return find_open_tag_end(text, start)


def transform_options(body):
    """Replace <option ...>...</option> with <SelectItem ...>...</SelectItem>.

    Empty value option becomes the trigger placeholder (returned separately).
    Dynamic option tags inside .map() get a plain tag rename.
    """
    placeholder = None
    out_parts = []
    i = 0
    n = len(body)
    while i < n:
        idx = body.find('<option', i)
        if idx < 0:
            out_parts.append(body[i:])
            break
        out_parts.append(body[i:idx])
        # Find end of open tag
        open_end = find_option_tag_end(body, idx)
        if open_end < 0:
            out_parts.append(body[idx:])
            break
        # Find matching </option>
        close = body.find('</option>', open_end)
        if close < 0:
            # Self-closing or malformed — rename only
            out_parts.append('<SelectItem' + body[idx + 7:open_end])
            i = open_end
            continue
        attrs_str = body[idx + 7:open_end - 1]
        inner = body[open_end:close]
        attrs = parse_attrs(attrs_str)
        v = attrs.get('value')
        if v and v[0] == 'string' and v[1] == '':
            # Empty-value option becomes the placeholder text.
            stripped = inner.strip()
            if stripped and not stripped.startswith('{'):
                placeholder = stripped
            i = close + len('</option>')
            continue
        kept = []
        for name, (kind, val) in attrs.items():
            if name in ('value', 'key', 'disabled'):
                if kind == 'string':
                    kept.append(f'{name}="{val}"')
                elif kind == 'expr':
                    kept.append(f'{name}={{{val}}}')
        attr_str = ' '.join(kept)
        if attr_str:
            attr_str = ' ' + attr_str
        out_parts.append(f'<SelectItem{attr_str}>{inner}</SelectItem>')
        i = close + len('</option>')
    new_body = ''.join(out_parts)
    return new_body, placeholder


SELECT_IMPORT = (
    'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\n'
)


def patch_file(path):
    with open(path) as f:
        src = f.read()
    if '<select' not in src:
        return False, "no-tag"
    out = []
    i = 0
    n = len(src)
    converted = 0
    bailed = 0
    while i < n:
        idx = src.find('<select', i)
        if idx < 0:
            out.append(src[i:])
            break
        # Guard: only true tag, not `<select-…` identifier
        if idx + 7 < n and (src[idx + 7].isalnum() or src[idx + 7] in '_-'):
            out.append(src[i:idx + 7])
            i = idx + 7
            continue
        out.append(src[i:idx])
        open_end = find_open_tag_end(src, idx)
        if open_end < 0:
            out.append(src[idx:])
            break
        # Find matching </select>
        close = src.find('</select>', open_end)
        if close < 0:
            out.append(src[idx:])
            break
        attrs_str = src[idx + 7:open_end - 1]
        body = src[open_end:close]
        attrs = parse_attrs(attrs_str)
        value_attr = attrs.get('value')
        onchange = attrs.get('onChange')
        if not value_attr or value_attr[0] != 'expr' or not onchange or onchange[0] != 'expr':
            bailed += 1
            out.append(src[idx:close + len('</select>')])
            i = close + len('</select>')
            continue
        value_expr = value_attr[1]
        onchange_new = transform_onchange(onchange[1])
        new_body, placeholder = transform_options(body)
        ph_attr = ''
        if placeholder:
            esc = placeholder.replace('"', '&quot;')
            ph_attr = f' placeholder="{esc}"'
        disabled = attrs.get('disabled')
        disabled_attr = ''
        if disabled and disabled[0] == 'expr':
            disabled_attr = f' disabled={{{disabled[1]}}}'
        replacement = (
            f'<Select value={{{value_expr}}} onValueChange={{{onchange_new}}}{disabled_attr}>'
            f'<SelectTrigger><SelectValue{ph_attr} /></SelectTrigger>'
            f'<SelectContent>{new_body}</SelectContent>'
            f'</Select>'
        )
        out.append(replacement)
        i = close + len('</select>')
        converted += 1

    new_src = ''.join(out)
    if converted == 0:
        return False, f"bailed-only ({bailed})"
    if '"@/components/ui/select"' not in new_src:
        m = re.search(r'(^import \{[^}]*\} from "@/components/ui/(?:input|button|badge|dialog|textarea)";\n)', new_src, re.M)
        if m:
            new_src = new_src[:m.end()] + SELECT_IMPORT + new_src[m.end():]
    with open(path, 'w') as f:
        f.write(new_src)
    return True, f"converted {converted}, bailed {bailed}"


if __name__ == '__main__':
    paths = sys.argv[1:]
    for p in paths:
        if not os.path.exists(p):
            print(f"  ! {p} missing")
            continue
        changed, msg = patch_file(p)
        marker = "✓" if changed else "—"
        print(f"  {marker} {p} ({msg})")
