export function preprocessCanvas(input: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = input.width;
  canvas.height = input.height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create preprocess canvas context");
  }

  ctx.drawImage(input, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  const threshold = 180;

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}