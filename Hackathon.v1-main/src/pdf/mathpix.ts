export async function runMathpix(base64: string) {
  const res = await fetch("https://api.mathpix.com/v3/text", {
    method: "POST",
    headers: {
      "app_id": "YOUR_APP_ID",
      "app_key": "YOUR_APP_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      src: base64,
      formats: ["latex_styled"],
    }),
  });

  const data = await res.json();
  return data.latex_styled;
}