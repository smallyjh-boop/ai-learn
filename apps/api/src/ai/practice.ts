import type { Locale, PracticeFeedback } from "@ai-learn/shared";
import type { AiProvider } from "./gateway";
import { config } from "../config";

const LANG_NAME: Record<Locale, string> = { th: "Thai", zh: "Simplified Chinese", en: "English" };

/** 练习时 AI 的角色：只回答这个练习任务相关内容，防止被当成免费聊天机器人 */
function practiceSystem(task: string, locale: Locale) {
  return [
    "You are the AI assistant inside a beginner course that teaches people how to use AI.",
    `The learner is doing this exercise: "${task}"`,
    "Answer the learner's prompt helpfully and briefly, as a normal AI assistant would, so they can see the result of their prompt.",
    "If the prompt is clearly unrelated to the exercise, or asks for anything harmful, politely say this practice box is only for the current exercise.",
    `Reply in the language the learner wrote in; if unclear, use ${LANG_NAME[locale]}.`,
    "Keep the answer under 250 words.",
  ].join("\n");
}

/** 点评模型：按课程里写好的评分标准给提示词打分，只输出 JSON */
function graderSystem(locale: Locale) {
  return [
    "GRADER. You grade a beginner's prompt for an AI-literacy course.",
    "You judge the PROMPT the learner wrote, not the AI's answer.",
    "Be encouraging and concrete. Beginners should pass if they meet most of the rubric.",
    `Write the feedback text in ${LANG_NAME[locale]}, in short, simple sentences.`,
    'Return ONLY JSON: {"score": <0-100 integer>, "good": [<=3 strings], "improve": [<=3 strings]}',
  ].join("\n");
}

export const PASS_SCORE = 60;

export interface PracticeUsage {
  kind: "practice" | "grade";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function parseFeedback(raw: string): PracticeFeedback {
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const obj = JSON.parse(match ? match[0] : raw) as Partial<{ score: number; good: string[]; improve: string[] }>;
    const score = Math.max(0, Math.min(100, Math.round(Number(obj.score) || 0)));
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 3) : []);
    return { score, passed: score >= PASS_SCORE, good: list(obj.good), improve: list(obj.improve) };
  } catch {
    // 点评解析失败时不要让用户卡住：给及格分让其继续
    return { score: PASS_SCORE, passed: true, good: [], improve: [] };
  }
}

export async function runPractice(
  ai: AiProvider,
  args: { task: string; rubric: string[]; prompt: string; locale: Locale },
): Promise<{ output: string; feedback: PracticeFeedback; usage: PracticeUsage[] }> {
  const answer = await ai.complete({
    system: practiceSystem(args.task, args.locale),
    user: args.prompt,
    model: config.ai.practiceModel,
    maxTokens: config.ai.maxOutputTokens,
  });

  const grading = await ai.complete({
    system: graderSystem(args.locale),
    user: [
      `Exercise: ${args.task}`,
      `Rubric:\n${args.rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
      `Learner's prompt:\n"""${args.prompt}"""`,
    ].join("\n\n"),
    model: config.ai.graderModel,
    maxTokens: 400,
  });

  return {
    output: answer.text,
    feedback: parseFeedback(grading.text),
    usage: [
      { kind: "practice", model: config.ai.practiceModel, inputTokens: answer.inputTokens, outputTokens: answer.outputTokens },
      { kind: "grade", model: config.ai.graderModel, inputTokens: grading.inputTokens, outputTokens: grading.outputTokens },
    ],
  };
}
