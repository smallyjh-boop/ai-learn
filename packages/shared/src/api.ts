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
  /** 会员来源：stripe | app_store | play_store */
  planSource: string | null;
  /** 会员到期时间（ISO 字符串） */
  planExpiresAt: string | null;
  /** 有网站付款记录，可以打开 Stripe 订阅管理页 */
  canManageBilling: boolean;
  xp: number;
  streak: number;
}

export interface StageWithLessons extends Stage {
  /** 是否免费阶段（由 FREE_STAGES 决定） */
  free: boolean;
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
  /** 内容审核：提示词与练习无关或不当 */
  flagged: boolean;
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
  code?: "QUOTA_EXCEEDED" | "LOCKED" | "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST" | "NOT_CONFIGURED";
}

/** 前两个阶段免费（唯一来源：前后端都用它判断） */
export const FREE_STAGES: readonly number[] = [0, 1];
export const isFreeStage = (stage: number) => FREE_STAGES.includes(stage);

/** 登录所需的公开配置（网站运行时从后端读取，不用在构建时写死） */
export interface AuthConfig {
  lineChannelId: string | null;
  googleClientId: string | null;
  devLogin: boolean;
}

export const LineCodeRequest = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  locale: z.string().optional(),
});

export const WaitlistRequest = z.object({
  email: z.string().email().max(200),
  locale: z.string().optional(),
});

export const CheckoutRequest = z.object({
  period: z.enum(["monthly", "yearly"]),
});

export interface UrlResponse {
  url: string;
}
