import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  PERSONALITY_FACTORS,
  GERCHIKOV_TYPES,
  RIASEC_TYPES,
  type FinalReport,
  type PersonalityTrait,
} from '@profai/shared';
import { PROFESSIONS_INFO, type ProfInfo } from './mockReport.js';

const labelMap = (defs: { key: string; label: string }[]) =>
  Object.fromEntries(defs.map((d) => [d.key, d.label])) as Record<string, string>;
const FACTOR = labelMap(PERSONALITY_FACTORS);
const GERCH = labelMap(GERCHIKOV_TYPES);
/** Обратный индекс label→key + нормализация: модель отдаёт то ключ, то рус. лейбл. */
const GERCH_KEY = Object.fromEntries(GERCHIKOV_TYPES.map((t) => [t.label, t.key]));
const toGKey = (x: string) => (GERCH[x] ? x : GERCH_KEY[x] ?? x);
const gLabel = (x: string) => GERCH[toGKey(x)] ?? x;

/** Черты-напряжения: высокие значения окрашиваем тёплым (не «плохо», а «под контроль»). */
const TENSION_FACTORS = new Set(['vigilance', 'apprehension', 'tension']);
function barTone(key: string, percent: number): '' | ' bar__fill--warn' | ' bar__fill--neutral' {
  if (TENSION_FACTORS.has(key)) return percent >= 55 ? ' bar__fill--warn' : ' bar__fill--neutral';
  if (percent >= 60) return '';
  return ' bar__fill--neutral';
}
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const pvar = (percent: number): CSSProperties => ({ ['--p' as string]: clamp(percent) / 100 });

/* ── Анимация при попадании в область видимости ── */
function useInView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (setSeen(true), io.disconnect())),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/* ── Активный раздел (подсветка панели слева) ── */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const onScroll = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids.join('|')]);
  return active;
}

const scrollToSection = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/* ── Радар (Герчиков / Холланд) ── */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function Radar({
  items,
  leadKeys = [],
}: {
  items: { key: string; label: string; percent: number }[];
  leadKeys?: string[];
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const C = 150;
  const R = 100;
  const labelR = R + 26;
  const n = items.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const pts = items.map((it, i) => polar(C, C, (R * clamp(it.percent)) / 100, (i * 360) / n));
  const polyPoints = pts.map((p) => p.join(',')).join(' ');
  return (
    <div className={`radar-wrap${seen ? ' in-view' : ''}`} ref={ref}>
      <svg className="radar" viewBox="-116 -10 532 320" role="img" aria-label="Диаграмма профиля">
        {rings.map((f) => (
          <polygon
            key={f}
            className="radar__grid"
            points={items.map((_, i) => polar(C, C, R * f, (i * 360) / n).join(',')).join(' ')}
          />
        ))}
        {items.map((_, i) => {
          const [x, y] = polar(C, C, R, (i * 360) / n);
          return <line key={i} className="radar__axis" x1={C} y1={C} x2={x} y2={y} />;
        })}
        <polygon className="radar__poly" points={polyPoints} />
        {pts.map((p, i) => (
          <circle key={i} className="radar__dot" cx={p[0]} cy={p[1]} r={3} />
        ))}
        {items.map((it, i) => {
          const [x, y] = polar(C, C, labelR, (i * 360) / n);
          const anchor = x < C - 6 ? 'end' : x > C + 6 ? 'start' : 'middle';
          const lead = leadKeys.includes(it.key);
          const words = it.label.split(' ');
          const lines = words.length > 1 && it.label.length > 11
            ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
            : [it.label];
          return (
            <text key={it.key} className={`radar__label${lead ? ' radar__label--lead' : ''}`} x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              {lines.map((ln, li) => (
                <tspan key={li} x={x} dy={li === 0 ? (lines.length > 1 ? '-0.4em' : 0) : '1.1em'}>
                  {ln} {li === lines.length - 1 ? `${Math.round(it.percent)}%` : ''}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      <div className="radar__legend note">Чем дальше точка от центра — тем сильнее выражен тип.</div>
    </div>
  );
}

/* ── Круговые датчики (Пинк) ── */
function Gauge({ label, percent }: { label: string; percent: number }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div className="gauge" ref={ref}>
      <div className="gauge__ring" style={pvarPct(seen ? percent : 0)}>
        <div className="gauge__hole">
          <span className="gauge__pct">{seen ? Math.round(percent) : 0}%</span>
        </div>
      </div>
      <div className="gauge__label">{label}</div>
    </div>
  );
}
const pvarPct = (percent: number): CSSProperties => ({ ['--p' as string]: clamp(percent) });

/* ── Аккордеон ── */
function Accordion({
  title,
  more = 'подробнее',
  defaultOpen = false,
  icon,
  children,
}: {
  title: string;
  more?: string;
  defaultOpen?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc${open ? ' is-open' : ''}`}>
      <button className="acc__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="acc__title">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </span>
        <span className="acc__more">{open ? 'свернуть' : more}</span>
        <svg className="acc__chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="acc__body">{children}</div>}
    </div>
  );
}

/* ── Секция ── */
function Section({
  id,
  num,
  kicker,
  title,
  sub,
  children,
}: {
  id: string;
  num?: string;
  kicker: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="rsection" id={id}>
      <div className="rsection__head">
        <div className="rsection__kicker">
          {num && <span className="rsection__kicker-num">{num}</span>}
          {kicker}
        </div>
        <h2 className="rsection__title">{title}</h2>
        {sub && <p className="rsection__sub">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const money = (i: ProfInfo['income']) =>
  `от ${Math.round(i.start / 1000)}к · медиана ${Math.round(i.mid / 1000)}к · до ${Math.round(i.max / 1000)}к ₽`;
const incomeFill = (i: ProfInfo['income']): CSSProperties => ({
  transform: `scaleX(${Math.max(0.1, Math.min(1, (i.mid - i.start) / Math.max(1, i.max - i.start)))})`,
});

export function ReportView({
  report,
  request,
  professions,
}: {
  report: FinalReport;
  request?: string;
  professions?: Record<string, ProfInfo>;
}) {
  const PROF = { ...PROFESSIONS_INFO, ...(professions ?? {}) };
  const pm = report.personality_map;
  const traits = useMemo(
    () => [...report.personality_traits].sort((a, b) => b.percent - a.percent),
    [report.personality_traits],
  );
  const stages = report.life_stages ?? [];

  // Разделы для панели навигации (в порядке теория → практика)
  const navSections = useMemo(() => {
    const base = [
      { id: 'personality', label: 'Личность' },
      ...(stages.length ? [{ id: 'stages', label: 'Этапы характера' }] : []),
      { id: 'potential', label: 'Потенциал' },
      { id: 'meaning', label: 'Смыслы' },
      { id: 'motivation', label: 'Мотивация' },
      { id: 'career', label: 'Карьера' },
    ];
    return base.map((s, i) => ({ ...s, num: String(i + 1).padStart(2, '0') }));
  }, [stages.length]);
  const allIds = ['hero', ...navSections.map((s) => s.id), 'plan'];
  const active = useActiveSection(allIds);

  // Интерактивный план: чекбоксы на действиях недель → прогресс
  const planItems = useMemo(
    () =>
      report.next_steps.weekly_plan.flatMap((w, wi) =>
        w.actions.map((_, ai) => `w${wi}-${ai}`),
    ),
    [report.next_steps.weekly_plan],
  );
  const storeKey = useMemo(() => {
    const src = (pm.direction || '') + (report.personality_summary || '');
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    return `profai.plan.${h}`;
  }, [pm.direction, report.personality_summary]);
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [storeKey]);
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(storeKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  const doneCount = planItems.filter((id) => done.has(id)).length;
  const pct = planItems.length ? Math.round((doneCount / planItems.length) * 100) : 0;

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {!mobile && <div className="rnav__group">Личность</div>}
      {navSections.map((s) => (
        <button
          key={s.id}
          className={`rnav__link${active === s.id ? ' is-active' : ''}`}
          onClick={() => scrollToSection(s.id)}
        >
          <span className="rnav__num">{s.num}</span>
          {s.label}
        </button>
      ))}
      {!mobile && <div className="rnav__group">План</div>}
      <button
        className={`rnav__link${active === 'plan' ? ' is-active' : ''}`}
        onClick={() => scrollToSection('plan')}
      >
        <span className="rnav__num" aria-hidden>◎</span>
        Следующие шаги
      </button>
    </>
  );

  return (
    <div className="rlayout">
      {/* ── Панель разделов (desktop) ── */}
      <aside className="rnav">
        <div className="rnav__inner">
          <NavLinks />
          <div className="rnav__progress">
            <div className="rnav__progress-top">
              <b>Твой план</b>
              <span className="rnav__progress-pct">{pct}%</span>
            </div>
            <div className="rnav__progress-track">
              <div className="rnav__progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <p className="rnav__hint">{doneCount} из {planItems.length} действий отмечено</p>
          </div>
        </div>
      </aside>

      <div className="rcontent">
        {/* Мобильная панель разделов */}
        <nav className="rnav--mobile">
          <NavLinks mobile />
        </nav>

        {/* ── Герой ── */}
        <header className="rhero" id="hero">
          <div className="rhero__eyebrow">Персональный разбор · profAI</div>
          <h1 className="rhero__title">{pm.direction}</h1>
          {request && (
            <div className="rhero__request">
              <div className="rhero__request-label">Твой запрос</div>
              <p>«{request}»</p>
            </div>
          )}
          <p className="rhero__lead">{report.personality_summary}</p>
          <div className="rhero__scroll">Листай вниз — начинаем с того, кто ты</div>
        </header>

        {/* ══════════ ТЕОРИЯ ══════════ */}

        {/* 01 · Личность */}
        <Section
          id="personality"
          num="01"
          kicker="Кто ты"
          title="Карта личности"
          sub="Сначала — про тебя: как ты устроен, как принимаешь решения и на что опираешься."
        >
          <p>{pm.narrative}</p>
          {pm.life_stage && (
            <p className="note"><span className="tag">этап</span>{pm.life_stage}</p>
          )}
          {pm.core_request_reflected && (
            <div className="rframe">
              <p><strong>Как это связано с твоим запросом.</strong> {pm.core_request_reflected}</p>
            </div>
          )}
          <div className="info-cards">
            {pm.key_characteristics.map((c) => (
              <div className="info-card" key={c.title}>
                <p className="info-card__title">{c.title}</p>
                <p className="info-card__desc">{c.explanation}</p>
              </div>
            ))}
          </div>

          <h3 className="rcard__title" style={{ marginTop: 24 }}>16 личностных факторов</h3>
          <p className="note" style={{ marginTop: 0 }}>Нажми на фактор, чтобы увидеть расшифровку и рекомендации.</p>
          <div className="card">
            <FactorList traits={traits} />
          </div>

          <div className="closing">
            <b>Резюме.</b> {report.personality_summary}
          </div>
        </Section>

        {/* 02 · Этапы характера */}
        {stages.length > 0 && (
          <Section
            id="stages"
            num="02"
            kicker="Как ты меняешься"
            title="Этапы характера"
            sub="Как твои качества могут раскрываться на ближайших этапах жизни."
          >
            <div className="timeline">
              {stages.map((st, i) => (
                <div className={`tl-item${i === 0 ? ' tl-item--now' : ''}`} key={st.age + st.title}>
                  <div className="tl-age">{st.age} лет{i === 0 ? ' · сейчас' : ''}</div>
                  <div className="tl-title">{st.title}</div>
                  <p style={{ margin: 0 }}>{st.narrative}</p>
                  {st.growth_zone && <p className="tl-zone">Зона роста: {st.growth_zone}</p>}
                  {st.recommendation && (
                    <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                      <span className="tag">шаг</span>{st.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Потенциал */}
        <Section
          id="potential"
          num={stages.length ? '03' : '02'}
          kicker="Опора и рост"
          title="Сильные стороны и зоны роста"
          sub="Сильные стороны — то, на что ты уже можешь опереться. Зоны роста — не «минусы», а привычки, которые можно перенастроить."
        >
          <div className="rframe">
            <p><strong>Сильные люди не «чинят слабости» — они усиливают сильное.</strong> Твоя задача — не просто узнать свои сильные стороны, а начать осознанно использовать их каждый день.</p>
          </div>
          <div className="rgrid">
            {report.potential.strengths.map((s) => (
              <div className="card" key={s.title}>
                <h3 className="rcard__title">{s.title}</h3>
                <p className="note">{s.meaning}</p>
                <p><span className="tag">где</span>{s.where_it_shows}</p>
                <p><span className="tag">как использовать</span>{s.how_to_use}</p>
                {s.how_to_strengthen?.length > 0 && (
                  <ul className="reflect">
                    {s.how_to_strengthen.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <h3 className="rcard__title" style={{ marginTop: 22 }}>Зоны роста</h3>
          <div className="rgrid">
            {report.potential.growth_areas.map((g) => (
              <div className="card card--growth" key={g.title}>
                <h3 className="rcard__title">{g.title}</h3>
                <p className="note">{g.description_with_example}</p>
                {g.how_to_work?.length > 0 && (
                  <ul className="reflect">
                    {g.how_to_work.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                )}
                <p style={{ marginBottom: 0 }}><span className="tag">сегодня</span>{g.action_today}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Смыслы */}
        <Section
          id="meaning"
          num={stages.length ? '04' : '03'}
          kicker="Ради чего"
          title="Смыслы и ценности"
          sub="На что опираться при выборе — шире, чем просто работа или деньги."
        >
          <div className="card card--accent">
            <span className="tag">миссия</span>
            <p style={{ margin: '8px 0 0', fontSize: 17, lineHeight: 1.5 }}>{report.meaning.mission}</p>
          </div>
          {report.meaning.purpose_orientation && (
            <p>{report.meaning.purpose_orientation}</p>
          )}
          <div className="rgrid" style={{ marginTop: 6 }}>
            <div className="card">
              <span className="tag">ролевая модель</span>
              <p style={{ marginBottom: 0 }}>{report.meaning.role_model_example}</p>
            </div>
            <div className="card">
              <span className="tag">чего избегать</span>
              <p style={{ marginBottom: 0 }}>{report.meaning.what_to_avoid}</p>
            </div>
          </div>

          {report.meaning.hidden_talents.length > 0 && (
            <>
              <h3 className="rcard__title" style={{ marginTop: 22 }}>Скрытые таланты</h3>
              <div className="rgrid">
                {report.meaning.hidden_talents.map((t) => (
                  <div className="card" key={t.title}>
                    <h3 className="rcard__title">{t.title}</h3>
                    <p className="note">{t.evidence}</p>
                    <p style={{ marginBottom: 0 }}><span className="tag">в карьере</span>{t.career_application}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Мотивация */}
        <Section
          id="motivation"
          num={stages.length ? '05' : '04'}
          kicker="Что даёт энергию"
          title="Мотивация"
          sub="От чего у тебя появляется драйв и желание действовать — и как выбирать задачи под это."
        >
          <div className="card">
            <h3 className="rcard__title">Вектор мотивации</h3>
            <Radar
              items={report.motivation.breakdown.map((b) => ({
                key: b.type_key,
                label: GERCH[b.type_key] ?? b.type_key,
                percent: b.percent,
              }))}
              leadKeys={[toGKey(report.motivation.leading_type)]}
            />
          </div>

          <div className="card">
            <h3 className="rcard__title">Что тобой движет (Пинк)</h3>
            <div className="gauges">
              <Gauge label="Автономия" percent={report.motivation.motivators.autonomy_percent} />
              <Gauge label="Мастерство" percent={report.motivation.motivators.mastery_percent} />
              <Gauge label="Цель" percent={report.motivation.motivators.purpose_percent} />
            </div>
            <p className="note" style={{ marginBottom: 0, marginTop: 14 }}>{report.motivation.motivators.narrative}</p>
          </div>

          <div className="rframe">
            <p>
              Ведущий тип — <strong>{gLabel(report.motivation.leading_type)}</strong>.
              {report.motivation.supporting_types.length > 0 && ` Поддерживают: ${report.motivation.supporting_types.map(gLabel).join(', ')}.`}
            </p>
            <p style={{ marginBottom: 0 }}>{report.motivation.narrative}</p>
          </div>

          {report.motivation.breakdown.some((b) => b.description) && (
            <>
              <h3 className="rcard__title" style={{ marginTop: 6 }}>Типы мотивации подробно</h3>
              {report.motivation.breakdown.map((b) => (
                <Accordion key={b.type_key} title={`${GERCH[b.type_key] ?? b.type_key} · ${Math.round(b.percent)}%`}>
                  <p>{b.description}</p>
                  {b.example_person && <p className="note" style={{ marginBottom: 0 }}><span className="tag">пример</span>{b.example_person}</p>}
                </Accordion>
              ))}
            </>
          )}
        </Section>

        {/* Мостик теория → практика */}
        <div className="rbridge">
          <div className="rbridge__icon" aria-hidden>→</div>
          <div>
            <p className="rbridge__t">От понимания — к действию</p>
            <p className="rbridge__d">Дальше собираем всё это в конкретные направления и шаги под твой запрос.</p>
          </div>
        </div>

        {/* Карьера */}
        <Section
          id="career"
          num={stages.length ? '06' : '05'}
          kicker="Куда тебе"
          title="Карьерный профиль"
          sub="В каком формате деятельности тебе проще всего раскрыться — и какие роли этому отвечают."
        >
          <div className="card">
            <div className="prof__head">
              <h3 className="rcard__title">Код Холланда</h3>
              <span className="income"><b>{report.career.holland_code}</b></span>
            </div>
            <Radar
              items={RIASEC_TYPES.map((t) => ({
                key: t.key,
                label: t.label,
                percent: report.career.riasec_profile.find((r) => r.type_key === t.key)?.percent ?? 0,
              }))}
              leadKeys={report.career.holland_code.split('')}
            />
          </div>
          <p>{report.career.narrative}</p>

          {report.career.business_directions && report.career.business_directions.length > 0 && (
            <div className="chip-row">
              {report.career.business_directions.map((d) => (
                <span className="chip" key={d}><span className="chip__dot" />{d}</span>
              ))}
            </div>
          )}

          <h3 className="rcard__title" style={{ marginTop: 24 }}>Подходящие профессии</h3>
          {report.career.suitable_professions.map((p) => {
            const info = PROF[p.profession_id];
            return (
              <div className="card prof" key={p.profession_id}>
                <div className="prof__head">
                  <h3 className="rcard__title">{info?.title ?? p.profession_id}</h3>
                  {info && <span className="income">{money(info.income)}</span>}
                </div>
                <p className="note">{p.why_it_fits}</p>
                {info && (
                  <>
                    <div className="income-bar"><div className="income-bar__fill" style={incomeFill(info.income)} /></div>
                    <div className="income-scale">
                      <span>старт</span><span>медиана</span><span>потолок</span>
                    </div>
                    <table className="skill-table">
                      <tbody>
                        <tr>
                          <td>навыки</td>
                          <td>
                            <div className="chip-row" style={{ marginTop: 0 }}>
                              {info.skills.map((s) => <span className="chip" key={s}><span className="chip__dot" />{s}</span>)}
                            </div>
                          </td>
                        </tr>
                        <tr><td>рост</td><td>{info.growthPath}</td></tr>
                        <tr><td>где</td><td>{info.companies.join(', ')}</td></tr>
                      </tbody>
                    </table>
                  </>
                )}
                {p.reflection_questions.length > 0 && (
                  <Accordion title="Вопросы для рефлексии" more="открыть">
                    <ul className="reflect" style={{ paddingLeft: 18 }}>
                      {p.reflection_questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </Accordion>
                )}
              </div>
            );
          })}

          {report.career.ideal_team && report.career.ideal_team.length > 0 && (
            <>
              <h3 className="rcard__title" style={{ marginTop: 22 }}>Идеальная команда рядом с тобой</h3>
              <div className="rgrid">
                {report.career.ideal_team.map((m) => (
                  <div className="card" key={m.role}>
                    <h3 className="rcard__title">{m.role}</h3>
                    <p className="note" style={{ marginBottom: 0 }}>{m.why}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="rcard__title" style={{ marginTop: 22 }}>Скорее не твоё</h3>
          <div className="rgrid">
            {report.career.unsuitable_professions.map((p) => (
              <div className="card prof--soft" key={p.profession_id}>
                <div className="prof__head">
                  <h3 className="rcard__title">{PROF[p.profession_id]?.title ?? p.profession_id}</h3>
                  <span className="income">совпадение {p.fit_probability}%</span>
                </div>
                <p className="note" style={{ marginBottom: 0 }}>{p.why_not}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ══════════ ПРАКТИКА / ФИНАЛ ══════════ */}
        <Section id="plan" kicker="◎ Итог" title="Следующие шаги" sub="Как превратить разбор в движение — начиная с ближайших 24 часов.">
          {request && (
            <p className="note" style={{ marginTop: 0 }}>
              <span className="tag">возвращаемся к запросу</span>«{request}»
            </p>
          )}
          <div className="cta">
            <div className="cta__eyebrow">🔥 Действие на ближайшие 24 часа</div>
            <p className="cta__text">{report.next_steps.action_24h}</p>
          </div>

          <h3 className="rcard__title">План на 4 недели</h3>
          <p className="note" style={{ marginTop: 0 }}>Отмечай выполненное — прогресс сохраняется и виден в панели слева.</p>
          <div className="week-grid">
            {report.next_steps.weekly_plan.map((w, wi) => (
              <div className="card week" key={w.week}>
                <div className="week__num">Неделя {w.week}</div>
                <h3 className="rcard__title">{w.title}</h3>
                <p className="note">{w.goal}</p>
                <div>
                  {w.actions.map((a, ai) => {
                    const id = `w${wi}-${ai}`;
                    return (
                      <label className="check" key={id}>
                        <input type="checkbox" checked={done.has(id)} onChange={() => toggle(id)} />
                        <span>{a}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="note" style={{ marginBottom: 0, marginTop: 8 }}><span className="tag">осторожно</span>{w.watch_out}</p>
              </div>
            ))}
          </div>

          <h3 className="rcard__title" style={{ marginTop: 22 }}>Типичные ловушки</h3>
          <div className="rgrid">
            {report.next_steps.traps.map((t) => (
              <div className="card card--growth" key={t.title}>
                <h3 className="rcard__title">{t.title}</h3>
                <p className="note">{t.description}</p>
                <p style={{ marginBottom: 0 }}><span className="tag">противоядие</span>{t.antidote}</p>
              </div>
            ))}
          </div>

          <div className="closing">
            <b>Главное.</b> {report.next_steps.tied_to_core_request}
          </div>
        </Section>

        <div className="rdisclaimer">
          Отчёт — инструмент самопознания, а не клиническая психодиагностика и не гарантия дохода. Решения ты принимаешь сам — этот разбор помогает сделать их более осознанными.
        </div>
      </div>
    </div>
  );
}

/* ── Список факторов с раскрытием детали ── */
function FactorList({ traits }: { traits: PersonalityTrait[] }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={`bars${seen ? ' in-view' : ''}`} ref={ref}>
      {traits.map((t) => {
        const label = FACTOR[t.factor_key] ?? t.factor_key;
        const isOpen = open === t.factor_key;
        return (
          <div className={`factor${isOpen ? ' is-open' : ''}`} key={t.factor_key}>
            <button className="factor__btn" onClick={() => setOpen(isOpen ? null : t.factor_key)} aria-expanded={isOpen}>
              <div className="bar__row">
                <div className="bar__label">{label}</div>
                <div className="bar__track">
                  <div className={`bar__fill${barTone(t.factor_key, t.percent)}`} style={pvar(t.percent)} />
                </div>
                <div className="bar__val">{Math.round(t.percent)}%</div>
              </div>
            </button>
            {isOpen && (
              <div className="factor__detail">
                {t.description && <p>{t.description}</p>}
                {t.interpretation && <p className="note">{t.interpretation}</p>}
                {t.recommendations?.length > 0 && (
                  <ul className="factor__recs">
                    {t.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
