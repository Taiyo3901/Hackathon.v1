export type Line = {
  text: string;
  x: number;
  y: number;
  width: number;
  page: number;
};

export function buildLines(items: any[]): Line[] {
  items.sort((a, b) => a.y - b.y);

  const lines: Line[] = [];
  const TH = 6;

  for (const item of items) {
    const last = lines[lines.length - 1];

    if (last && Math.abs(last.y - item.y) < TH) {
      last.text += " " + item.str;
    } else {
      lines.push({
        text: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        page: item.page,
      });
    }
  }

  return lines;
}

export function detectColumns(lines: Line[]): Line[] {
  const pages = new Map<number, Line[]>();

  for (const line of lines) {
    const arr = pages.get(line.page) || [];
    arr.push(line);
    pages.set(line.page, arr);
  }

  const result: Line[] = [];

  for (const [, pageLines] of pages) {
    const xs = pageLines.map((l) => l.x).sort((a, b) => a - b);

    const median = xs[Math.floor(xs.length / 2)];

    const left = pageLines.filter((l) => l.x < median);
    const right = pageLines.filter((l) => l.x >= median);

    if (left.length > 10 && right.length > 10) {
      result.push(...left.sort((a, b) => a.y - b.y));
      result.push(...right.sort((a, b) => a.y - b.y));
    } else {
      result.push(...pageLines.sort((a, b) => a.y - b.y));
    }
  }

  return result;
}
