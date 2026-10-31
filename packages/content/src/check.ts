/**
 * 课程内容检查：pnpm content:check
 * - 所有 JSON 是否符合格式
 * - 中文/英文是否缺了泰语已有的课（缺的会回退到泰语，这里只提醒）
 */
import { loadCatalog } from "./index";
import { LOCALES, DEFAULT_LOCALE } from "@ai-learn/shared";

const cat = loadCatalog();
const base = [...cat.lessons[DEFAULT_LOCALE].keys()].sort();
console.log(`泰语（主语言）共 ${base.length} 课`);

let warn = 0;
for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const missing = base.filter((id) => !cat.lessons[locale].has(id));
  const extra = [...cat.lessons[locale].keys()].filter((id) => !base.includes(id));
  console.log(`${locale}: ${cat.lessons[locale].size} 课`);
  if (missing.length) { warn++; console.log(`  缺少（将回退泰语）: ${missing.join(", ")}`); }
  if (extra.length) { warn++; console.log(`  泰语没有的课（不会显示）: ${extra.join(", ")}`); }
}
console.log(warn ? "检查完成，有提醒" : "检查通过");
