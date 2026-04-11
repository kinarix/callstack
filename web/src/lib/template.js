export function resolveTemplate(text, variables) {
    if (!text || !variables.length)
        return text;
    const activeVars = variables.filter((v) => v.enabled !== false && v.key.trim());
    if (!activeVars.length)
        return text;
    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
        const found = activeVars.find((v) => v.key === key);
        return found !== undefined ? found.value : match;
    });
}
