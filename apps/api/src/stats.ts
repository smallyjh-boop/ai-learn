import type { Lesson } from "@ai-learn/shared";
import type { LessonSessionRow } from "./db/store";

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(s[lo]! + (s[hi]! - s[lo]!) * (i - lo));
};

export interface LessonStats {
  lessonId: string;
  title: string;
  /** 课程里写的标称分钟数 */
  nominalMin: number;
  /** 样本数（只算首次完成） */
  n: number;
  medianMin: number;
  p75Min: number;
  /** 每一步的中位秒数 */
  stepMedianSec: Array<{ index: number; type: string; sec: number }>;
  /** 中位用时最长的一步（用户最可能卡住的地方） */
  slowestStep: { index: number; type: string; sec: number } | null;
  /** 建议：实际中位用时与标称相差超过 30% 时提示调整 */
  suggestion: "ok" | "nominal_too_high" | "nominal_too_low" | "not_enough_data";
}

/** 统计一课的学习用时。只用首次完成的记录（重学会快很多），样本少于 minN 时不给建议 */
export function lessonStats(lesson: Lesson, sessions: LessonSessionRow[], minN = 10): LessonStats {
  const rows = sessions.filter((s) => s.first && s.stepSeconds.length === lesson.steps.length);
  const durations = rows.map((r) => r.durationSec);
  const stepMedianSec = lesson.steps.map((st, index) => ({ index, type: st.type, sec: percentile(rows.map((r) => r.stepSeconds[index] ?? 0), 0.5) }));
  const medianSec = percentile(durations, 0.5);
  const medianMin = Math.round((medianSec / 60) * 10) / 10;
  const ratio = medianMin / lesson.minutes;
  return {
    lessonId: lesson.id,
    title: lesson.title,
    nominalMin: lesson.minutes,
    n: rows.length,
    medianMin,
    p75Min: Math.round((percentile(durations, 0.75) / 60) * 10) / 10,
    stepMedianSec,
    slowestStep: rows.length ? stepMedianSec.reduce((a, b) => (b.sec > a.sec ? b : a)) : null,
    suggestion: rows.length < minN ? "not_enough_data" : ratio < 0.7 ? "nominal_too_high" : ratio > 1.3 ? "nominal_too_low" : "ok",
  };
}
