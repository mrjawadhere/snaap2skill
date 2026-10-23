import axios from "axios";
import { ENV } from "./_core/env";

const GEMMA_MODELS = [
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-2.5-flash",
];

export async function callGemma(
  prompt: string,
  imageBase64?: { mimeType: string; data: string }
): Promise<string> {
  const apiKey = ENV.gemmaApiKey;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMMA_API_KEY or GEMINI_API_KEY is not configured");
  }

  const parts: Array<Record<string, unknown>> = [];

  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: imageBase64.mimeType,
        data: imageBase64.data,
      },
    });
  }

  parts.push({ text: prompt });

  let lastError: Error | null = null;

  // If image is present, try models capable of vision first
  const modelsToTry = imageBase64
    ? ["gemini-2.5-flash", "gemma-4-31b-it", "gemma-4-26b-a4b-it"]
    : GEMMA_MODELS;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        },
        { timeout: 30000 }
      );

      const candidate = response.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text) {
        return text.trim();
      }
    } catch (err: any) {
      lastError = err;
      // Try next model if current fails
      continue;
    }
  }

  throw lastError ?? new Error("Failed to get response from Gemma model");
}

export async function chatWithGemma(
  message: string,
  history: Array<{ role: "assistant" | "user"; text: string }>,
  skillMarkdown: string
): Promise<string> {
  const systemPrompt = `You are an AI executing the following Agent Skill:

${skillMarkdown}

Instruction: Follow the workflow, decision paths, and output contract specified in the skill above. Respond concisely and professionally (2-4 sentences max).

Conversation history:
${history.map((h) => `${h.role === "user" ? "User" : "Agent"}: ${h.text}`).join("\n")}

User: ${message}
Agent:`;

  return await callGemma(systemPrompt);
}
