import { z } from "zod";
import type { Locale } from "./locale";
import type { LessonMeta, Stage, Lesson } from "./course";

/** ===== 前后端共用的接口类型 ===== */

export type Plan = "free" | "pro";

export interface Me {
  id: string;
  email: string | null;
  name: string | null;
  locale: Locale;
  plan: Plan;
  xp: number;
  streak: number;
}

export interface StageWithLessons extends Stage {
  lessons: LessonMeta[];
}

export interface CourseMapResponse {
  stages: StageWithLessons[];
}

export interface LessonResponse {
  lesson: Lesson;
  locked: boolean;
}

export const PracticeRequest = z.object({
  lessonId: z.string(),
  stepIndex: z.number().int().min(0),
  prompt: z.string().min(1).max(2000),
});
export type PracticeRequest = z.infer<typeof PracticeRequest>;

export interface PracticeFeedback {
  /** 0-100 */
  score: number;
  passed: boolean;
  /** 做得好的地方 */
  good: string[];
  /** 可以改进的地方 */
  improve: string[];
}

export interface PracticeResponse {
  output: string;
  feedback: PracticeFeedback;
  quota: { used: number; limit: number };
}

export const CompleteRequest = z.object({
  lessonId: z.string(),
  score: z.number().int().min(0).max(100).optional(),
});
export type CompleteRequest = z.infer<typeof CompleteRequest>;

export const DevLoginRequest = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export interface AuthResponse {
  token: string;
  me: Me;
}

export interface ApiError {
  error: string;
  code?: "QUOTA_EXCEEDED" | "LOCKED" | "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST";
}

/** 前两个阶段免费 */
export const FREE_STAGES = [0, 1];
