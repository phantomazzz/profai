const REPORT_BLOCKS = [
  { title: 'Личность', desc: 'Сильные стороны и зоны роста, 16 граней характера — без ярлыков и диагнозов.' },
  { title: 'Карьера', desc: 'Подходящие и неподходящие профессии, направления и твоя идеальная команда.' },
  { title: 'Смыслы', desc: 'Жизненная миссия, скрытые таланты и то, чего тебе стоит избегать.' },
];

const TEST_BLOCKS = ['Интересы', 'Черты характера', 'Мотивация', 'Драйверы'];

export function IntroScreen() {
  return (
    <div className="container">
      <h1>
        Профориентация с <span className="accent">ИИ</span>
      </h1>
      <p className="lead">
        Это не просто тест. По твоим ответам мы соберём <span className="uline">персональный разбор</span>:
        кто ты по складу, где раскроешься в карьере и в чём твой смысл. Займёт ~18–22 минуты.
      </p>

      <div className="card">
        <h2>Как всё устроено</h2>
        <p className="note">
          Сначала — несколько открытых вопросов о тебе и твоём запросе. Затем — блоки с вариантами
          ответов. Пока ты отвечаешь, ИИ уже готовит черновик разбора — поэтому финальный отчёт
          появится быстро.
        </p>
        <div className="chip-row">
          {TEST_BLOCKS.map((b) => (
            <span className="chip" key={b}>
              <span className="chip__dot" />
              {b}
            </span>
          ))}
        </div>
      </div>

      <h2 style={{ marginTop: 28 }}>Что получишь в отчёте</h2>
      <div className="info-cards">
        {REPORT_BLOCKS.map((b) => (
          <div className="info-card" key={b.title}>
            <p className="info-card__title">{b.title}</p>
            <p className="info-card__desc">{b.desc}</p>
          </div>
        ))}
      </div>
      <p className="note" style={{ marginTop: 4 }}>
        А в конце — конкретный план действий на 24 часа и 4 недели.
      </p>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        Отчёт — инструмент самопознания, а не клиническая психодиагностика и не гарантия дохода.
      </div>
    </div>
  );
}
