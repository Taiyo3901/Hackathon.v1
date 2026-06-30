import { preprocessCanvas } from "./preprocess";

export async function runOCR(sourceCanvas: HTMLCanvasElement): Promise<string> {
  const processedCanvas = preprocessCanvas(sourceCanvas);

  const tesseract = await import("tesseract.js");

  const worker = await tesseract.createWorker("eng+jpn");

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
    } as any);

    const result = await worker.recognize(processedCanvas);

    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
``