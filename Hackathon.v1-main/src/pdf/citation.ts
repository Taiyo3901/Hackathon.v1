export function detectCitations(lines: any[]) {
  const re = /\[\d+\]|\([A-Za-z]+, \d{4}\)/g;

  const citations: any[] = [];

  for (const line of lines) {
    const matches = line.text.match(re);
    if (!matches) continue;

    matches.forEach((m: string) => {
      citations.push({
        text: m,
        page: line.page,
        line: line.text
      });
    });
  }

  return citations;
}

export function parseReferences(lines: any[]) {
  const start = lines.findIndex(l =>
    l.text.match(/References/i)
  );

  if (start === -1) return [];

  const refs: any[] = [];
  let current: any = null;

  for (const line of lines.slice(start + 1)) {
    if (line.text.match(/^\[\d+\]/)) {
      if (current) refs.push(current);

      current = {
        id: line.text.match(/\[\d+\]/)[0],
        text: line.text,
        page: line.page
      };
    } else if (current) {
      current.text += " " + line.text;
    }
  }

  if (current) refs.push(current);

  return refs;
}
