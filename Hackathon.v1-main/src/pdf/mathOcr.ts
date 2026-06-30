export async function runMathOcr(base64Png: string): Promise<string> {
  const env = (import.meta as any).env ?? {};

  const appId = env.VITE_MATHPIX_APP_ID;
  const appKey = env.VITE_MATHPIX_APP_KEY;

  if (!appId || !appKey) {
    throw new Error(
      "Math OCR APIキーが未設定です。VITE_MATHPIX_APP_ID と VITE_MATHPIX_APP_KEY を .env に設定してください。"
    );
  }

  const response = await fetch("https://api.mathpix.com/v3/text", {
    method: "POST",
    headers: {
      app_id: appId,
      app_key: appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      src: base64Png,
      formats: ["latex_styled", "text"],
      data_options: {
        include_asciimath: true,
        include_latex: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Math OCR failed: ${response.status}`);
  }

  const data = await response.json();

  return data.latex_styled || data.latex || data.text || "";
}