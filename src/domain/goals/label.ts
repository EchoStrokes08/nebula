/** Reparte un título en líneas de como mucho `width` caracteres, cortando por palabras. */
export function wrapLabel(text: string, width = 22): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line = `${line} ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}
