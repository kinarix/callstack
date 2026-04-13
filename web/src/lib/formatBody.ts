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

export function formatBody(body: string, contentType: string): string {
  const text = normalizeLineEndings(body);
  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }
  if (contentType.includes('xml') || contentType.includes('html')) {
    return formatXml(text);
  }
  return text;
}
