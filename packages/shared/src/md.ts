/**
 * 极简 Markdown 解析（课程讲解用）：段落、无序/有序列表、**加粗**。
 * 返回结构化数据，网站和 App 各自渲染，避免引入重型库和 HTML 注入风险。
 */
export interface Inline { text: string; bold: boolean }
export type MdBlock =
  | { type: "p"; inline: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const parts = s.split("**");
  parts.forEach((text, i) => { if (text) out.push({ text, bold: i % 2 === 1 }); });
  return out;
}

export function parseMd(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const chunk of src.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
    let para: string[] = [];
    const flushPara = () => { if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) }); para = []; };
    const flushList = () => { if (list) blocks.push(list); list = null; };
    for (const line of lines) {
      const ul = line.match(/^\s*[-*]\s+(.*)$/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const kind = ul ? "ul" : ol ? "ol" : null;
      if (kind) {
        flushPara();
        if (!list || list.type !== kind) { flushList(); list = { type: kind, items: [] }; }
        list.items.push(parseInline((ul ?? ol)![1]!));
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}
