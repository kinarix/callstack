function formatXml(xml: string): string {
  try {
    const lines = xml.replace(/>\s*</g, '>\n<').split('\n');
    let level = 0;
    return lines
      .map(line => {
        line = line.trim();
        if (!line) return '';
        if (line.startsWith('</')) {
          level = Math.max(0, level - 1);
          return '  '.repeat(level) + line;
        }
        const indented = '  '.repeat(level) + line;
        if (!line.startsWith('<?') && !line.startsWith('<!--') && !line.endsWith('/>') && !/<[^>]+\/>/.test(line) && !line.includes('</')) {
          level++;
        }
        return indented;
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return xml;
  }
}

export function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function formatJson(text: string): string {
  // Fast path: no template tokens — try direct parse
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Slow path: body has bare template tokens outside strings.
    // Walk the text character-by-character, preserving JSON strings verbatim
    // and replacing bare {{tokens}} with unique placeholders so JSON.parse succeeds.
    const tokenMap: string[] = [];
    let replaced = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '"') {
        // Consume entire JSON string (handles escape sequences)
        let j = i + 1;
        while (j < text.length) {
          if (text[j] === '\\') { j += 2; continue; }
          if (text[j] === '"') { j++; break; }
          j++;
        }
        replaced += text.slice(i, j);
        i = j;
      } else {
        const tokenMatch = text.slice(i).match(/^\{\{[\w.\s$#-]+\}\}/);
        if (tokenMatch) {
          const idx = tokenMap.length;
          tokenMap.push(tokenMatch[0]);
          replaced += `"__TMPL_${idx}__"`;
          i += tokenMatch[0].length;
        } else {
          replaced += text[i++];
        }
      }
    }
    try {
      let formatted = JSON.stringify(JSON.parse(replaced), null, 2);
      formatted = formatted.replace(/"__TMPL_(\d+)__"/g, (_, n) => tokenMap[parseInt(n, 10)]);
      return formatted;
    } catch {
      return text;
    }
  }
}

export function formatBody(body: string, contentType: string): string {
  const text = normalizeLineEndings(body);
  if (contentType.includes('json')) return formatJson(text);
  if (contentType.includes('xml') || contentType.includes('html')) return formatXml(text);
  return text;
}
