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
        if (!line.startsWith('<?') && !line.startsWith('<!--') && !line.endsWith('/>') && !/<[^>]{1,500}\/>/.test(line) && !line.includes('</')) {
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
    // Single regex pass: match JSON strings (preserve) or {{tokens}} (replace with placeholders).
    const tokenMap: string[] = [];
    const replaced = text.replace(
      /"(?:[^"\\]|\\.)*"|\{\{[\w.\s$#-]+\}\}/g,
      (match) => {
        if (match[0] === '"') return match;
        const i = tokenMap.length;
        tokenMap.push(match);
        return `"__TMPL_${i}__"`;
      },
    );
    try {
      let formatted = JSON.stringify(JSON.parse(replaced), null, 2);
      if (tokenMap.length > 0) {
        formatted = formatted.replace(/"__TMPL_(\d+)__"/g, (_, n) => tokenMap[parseInt(n, 10)]);
      }
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
