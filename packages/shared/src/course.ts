import { z } from "zod";
import { LOCALES } from "./locale";

/**
 * 课程内容格式（三端共用）
 * 一节课 = 若干「步骤」：讲解 → 示例 → 小测验 → 动手练习
 */

export const ExplainStep = z.object({
  type: z.literal("explain"),
  /** 支持简单 Markdown */
  body: z.string().min(1),
});

export const ExampleStep = z.object({
  type: z.literal("example"),
  /** 不好的提问（可选，用于对比） */
  bad: z.string().optional(),
  /** 好的提问 */
  prompt: z.string().min(1),
  /** 预先生成好的 AI 回答（不实时调用，省钱） */
  output: z.string().min(1),
  note: z.string().optional(),
});

export const QuizStep = z.object({
  type: z.literal("quiz"),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
  answer: z.number().int().min(0),
  explain: z.string().optional(),
});

export const PracticeStep = z.object({
  type: z.literal("practice"),
  /** 给用户的任务说明 */
  task: z.string().min(1),
  /** 点评模型用的评分标准，每条一个要点 */
  rubric: z.array(z.string().min(1)).min(1),
  /** 提示词输入框的字数上限 */
  maxChars: z.number().int().positive().default(600),
  /** 输入框占位提示 */
  placeholder: z.string().optional(),
});

export const LessonStep = z.discriminatedUnion("type", [ExplainStep, ExampleStep, QuizStep, PracticeStep]);

export const Lesson = z
  .object({
    id: z.string().regex(/^s\d+-\d{2}$/, "id 格式：s<阶段>-<两位序号>，如 s0-01"),
    locale: z.enum(LOCALES),
    stage: z.number().int().min(0).max(9),
    order: z.number().int().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    minutes: z.number().int().positive(),
    xp: z.number().int().nonnegative().default(10),
    steps: z.array(LessonStep).min(1),
  })
  .superRefine((l, ctx) => {
    l.steps.forEach((s, i) => {
      if (s.type === "quiz" && s.answer >= s.options.length) {
        ctx.addIssue({ code: "custom", path: ["steps", i, "answer"], message: "answer 超出选项范围" });
      }
    });
  });

export const Stage = z.object({
  stage: z.number().int().min(0),
  locale: z.enum(LOCALES),
  title: z.string(),
  summary: z.string(),
  /** 免费阶段不需要订阅 */
  free: z.boolean(),
});

export type LessonStep = z.infer<typeof LessonStep>;
export type Lesson = z.infer<typeof Lesson>;
export type Stage = z.infer<typeof Stage>;

/** 课程列表里用的精简信息（不含步骤内容） */
export type LessonMeta = Omit<Lesson, "steps"> & { locked: boolean; completed: boolean };
