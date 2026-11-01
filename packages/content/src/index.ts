import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Lesson, Stage, LOCALES, DEFAULT_LOCALE, isFreeStage, type CourseMapResponse, type Locale } from "@ai-learn/shared";

/**
 * 课程内容加载器（仅在服务端/构建时使用）
 * 目录结构：
 *   courses/<locale>/stages.json
 *   courses/<locale>/lessons/<lessonId>.json
 * 某语言缺某一课时，回退到泰语版本。
 */
const ROOT = process.env.CONTENT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "courses");

export interface Catalog {
  stages: Record<Locale, Stage[]>;
  lessons: Record<Locale, Map<string, Lesson>>;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadCatalog(root = ROOT): Catalog {
  const stages = {} as Catalog["stages"];
  const lessons = {} as Catalog["lessons"];

  for (const locale of LOCALES) {
    const dir = join(root, locale);
    stages[locale] = existsSync(join(dir, "stages.json"))
      ? Stage.array().parse(readJson(join(dir, "stages.json")))
      : [];

    const map = new Map<string, Lesson>();
    const lessonDir = join(dir, "lessons");
    if (existsSync(lessonDir)) {
      for (const file of readdirSync(lessonDir).filter((f) => f.endsWith(".json"))) {
        const parsed = Lesson.safeParse(readJson(join(lessonDir, file)));
        if (!parsed.success) {
          throw new Error(`课程格式错误 ${locale}/${file}: ${parsed.error.message}`);
        }
        if (parsed.data.locale !== locale) {
          throw new Error(`课程 ${locale}/${file} 的 locale 字段写成了 ${parsed.data.locale}`);
        }
        map.set(parsed.data.id, parsed.data);
      }
    }
    lessons[locale] = map;
  }
  return { stages, lessons };
}

/** 取某语言的课程，没有就回退到默认语言（泰语） */
export function getLesson(cat: Catalog, locale: Locale, id: string): Lesson | undefined {
  return cat.lessons[locale].get(id) ?? cat.lessons[DEFAULT_LOCALE].get(id);
}

export function getStages(cat: Catalog, locale: Locale): Stage[] {
  return cat.stages[locale].length ? cat.stages[locale] : cat.stages[DEFAULT_LOCALE];
}

/** 按阶段、序号排好的课程列表（以默认语言为准，确保各语言课程顺序一致） */
export function listLessons(cat: Catalog, locale: Locale): Lesson[] {
  const ids = [...cat.lessons[DEFAULT_LOCALE].keys()];
  return ids
    .map((id) => getLesson(cat, locale, id)!)
    .sort((a, b) => a.stage - b.stage || a.order - b.order);
}

/**
 * 课程地图（API 和网站服务端渲染共用）。
 * pro / done 不传时按未登录用户计算：付费阶段上锁、没有完成记录。
 */
export function courseMap(
  cat: Catalog,
  locale: Locale,
  opts: { pro?: boolean; done?: { has(id: string): boolean } } = {},
): CourseMapResponse {
  const lessons = listLessons(cat, locale);
  const stages = getStages(cat, locale).map((s) => {
    const free = isFreeStage(s.stage);
    return {
      ...s,
      free,
      lessons: lessons
        .filter((l) => l.stage === s.stage)
        .map(({ steps: _steps, ...meta }) => ({ ...meta, locked: !free && !opts.pro, completed: Boolean(opts.done?.has(meta.id)) })),
    };
  });
  return { stages };
}
