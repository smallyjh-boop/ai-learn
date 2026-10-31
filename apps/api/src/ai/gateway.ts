import { config } from "../config";

/**
 * AI 网关：所有 AI 调用都经过这里。
 * 换供应商（OpenAI / Gemini / 便宜的模型）只需新增一个 Provider，不影响业务代码。
 */
export interface CompleteInput {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
}

export interface AiProvider {
  name: string;
  complete(input: CompleteInput): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}

export class AnthropicProvider implements AiProvider {
  name = "anthropic";
  constructor(private apiKey: string) {}

  async complete({ system, user, model, maxTokens }: CompleteInput) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };
    const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return { text, inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens };
  }
}

/** 本地开发用：不花钱，返回固定内容。点评按提示词长度粗略给分，方便测试界面。 */
export class MockProvider implements AiProvider {
  name = "mock";
  async complete({ system, user }: CompleteInput) {
    if (system.includes("GRADER")) {
      const len = user.length;
      const score = Math.min(95, 40 + Math.floor(len / 6));
      return {
        text: JSON.stringify({
          score,
          good: ["(mock) The request is clear"],
          improve: score < 80 ? ["(mock) Add who will read it and the tone you want"] : [],
        }),
        inputTokens: 0,
        outputTokens: 0,
      };
    }
    return { text: `(mock AI answer)\n\n${user.slice(0, 200)}`, inputTokens: 0, outputTokens: 0 };
  }
}

export function createProvider(): AiProvider {
  if (config.ai.provider === "anthropic" && config.ai.anthropicKey) {
    return new AnthropicProvider(config.ai.anthropicKey);
  }
  return new MockProvider();
}
