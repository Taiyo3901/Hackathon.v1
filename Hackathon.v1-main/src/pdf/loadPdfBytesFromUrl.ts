export async function loadPdfBytesFromUrl(url: string): Promise<ArrayBuffer> {
  const normalizedUrl = normalizePdfUrl(url);

  try {
    const response = await fetch(normalizedUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "PDF URLから元PDFデータを取得できませんでした。",
        "",
        `URL: ${normalizedUrl}`,
        `詳細: ${message}`,
        "",
        "file:// のPDFをChrome拡張で開いている場合は、",
        "Chromeの拡張機能詳細画面で「ファイルのURLへのアクセスを許可する」をONにしてください。",
        "",
        "それでも取得できない場合は、操作タブの「PDFを読み込む」からファイル選択で開いてください。",
      ].join("\n")
    );
  }
}

function normalizePdfUrl(url: string): string {
  if (url.startsWith("file:")) {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  }
  return url;
}
