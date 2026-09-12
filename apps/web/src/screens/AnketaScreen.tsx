import { ANKETA_FIELDS } from '@profai/shared';

export function AnketaScreen({
  profile,
  onChange,
}: {
  profile: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="container">
      <h1>Немного о тебе</h1>
      <p className="lead">7 коротких полей. Точные суммы не спрашиваем — только то, что нужно для разбора.</p>
      <div className="card">
        {ANKETA_FIELDS.map((f) => {
          const value = profile[f.key] ?? '';
          return (
            <label className="field" key={f.key}>
              <span className="lbl">
                {f.label}
                {f.required ? '' : ' (необязательно)'}
              </span>
              {f.hint && <span className="hint">{f.hint}</span>}
              {f.type === 'select' ? (
                <select value={value} onChange={(e) => onChange(f.key, e.target.value)}>
                  <option value="">— выбери —</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === 'longtext' ? (
                <textarea value={value} onChange={(e) => onChange(f.key, e.target.value)} />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
