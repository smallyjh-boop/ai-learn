import { parseMd, type Inline } from "@ai-learn/shared";

const Line = ({ inline }: { inline: Inline[] }) => (
  <>{inline.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}</>
);

export function Md({ text }: { text: string }) {
  return (
    <div className="md">
      {parseMd(text).map((b, i) => {
        if (b.type === "p") return <p key={i}><Line inline={b.inline} /></p>;
        const List = b.type;
        return <List key={i}>{b.items.map((it, j) => <li key={j}><Line inline={it} /></li>)}</List>;
      })}
    </div>
  );
}
