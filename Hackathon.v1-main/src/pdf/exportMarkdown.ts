export function exportMd(text: string) {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "output.md";
  a.click();
}
``