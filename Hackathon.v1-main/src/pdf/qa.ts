export type AskQuestionInput = {
  question: string;
  context: string;
};

export type AskQuestionOutput = {
  answer: string;
};

export async function askPaperQuestion(
  input: AskQuestionInput
): Promise<AskQuestionOutput> {
  const env = (import.meta as any).env ?? {};
  const endpoint = env.VITE_QA_ENDPOINT;

  if (!endpoint) {
    return {
      answer:
        "Q&A APIエンドポイントが未設定です。VITE_QA_ENDPOINT を設定すると、このPDF本文を使ったQ&Aが実行できます。",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Q&A request failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    answer: String(data.answer ?? ""),
  };
}