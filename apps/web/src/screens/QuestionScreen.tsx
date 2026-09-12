import type { SeedQuestion } from '@profai/shared';

const LIKERT = [
  { v: 5, l: 'Полностью согласен' },
  { v: 4, l: 'Скорее согласен' },
  { v: 3, l: 'Затрудняюсь' },
  { v: 2, l: 'Скорее не согласен' },
  { v: 1, l: 'Полностью не согласен' },
];

const RIASEC4 = [
  { v: 1, l: 'Совсем нет' },
  { v: 2, l: 'Скорее нет' },
  { v: 3, l: 'Скорее да' },
  { v: 4, l: 'Определённо да' },
];

function Eyebrow({ section, idx, total }: { section: string; idx: number; total: number }) {
  return (
    <div className="qmeta">
      <span className="mono">{section}</span>
      <span className="mono qmeta__count">
        {idx} / {total}
      </span>
    </div>
  );
}

export function ClosedQuestionScreen({
  question,
  section,
  idx,
  total,
  value,
  onAnswer,
}: {
  question: SeedQuestion;
  section: string;
  idx: number;
  total: number;
  value: number | undefined;
  onAnswer: (value: number) => void;
}) {
  const opts = question.scaleType === 'RIASEC_4' ? RIASEC4 : LIKERT;
  return (
    <div className="container">
      <Eyebrow section={section} idx={idx} total={total} />
      <div className="card card--question">
        <p className="qbig">{question.text}</p>
        <div className="scale scale--grid">
          {opts.map((o) => (
            <button
              key={o.v}
              className={`opt${value === o.v ? ' opt--on' : ''}`}
              onClick={() => onAnswer(o.v)}
              type="button"
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OpenQuestionScreen({
  question,
  section,
  idx,
  total,
  value,
  onChange,
}: {
  question: { key: string; text: string };
  section: string;
  idx: number;
  total: number;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="container">
      <Eyebrow section={section} idx={idx} total={total} />
      <div className="card card--question">
        <p className="qbig">{question.text}</p>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="Твой ответ…" autoFocus />
        <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
          Отвечай свободно — пары честных фраз достаточно.
        </p>
      </div>
    </div>
  );
}
