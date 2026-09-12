export function ConsentScreen({
  consented,
  onToggle,
}: {
  consented: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="container">
      <h1>Согласие на обработку данных</h1>
      <p className="lead">
        Тест собирает чувствительные данные (возраст, доход диапазоном, переживания о карьере), чтобы
        сделать разбор персональным. Нам важно твоё осознанное согласие.
      </p>
      <div className="card">
        <p className="note" style={{ marginTop: 0 }}>
          Твои ответы будут:
        </p>
        <ul className="note" style={{ paddingLeft: 18 }}>
          <li>использованы только для формирования твоего отчёта;</li>
          <li>
            переданы для анализа в языковую ИИ-модель стороннего провайдера (в том числе за
            пределами РФ) — в обезличенном для модели виде, без прямых идентификаторов сверх
            необходимого;
          </li>
          <li>доступны тебе по личной ссылке на отчёт.</li>
        </ul>
      </div>
      <label className="consent">
        <input type="checkbox" checked={consented} onChange={(e) => onToggle(e.target.checked)} />
        <span className="note">
          Я даю согласие на обработку моих персональных данных и их передачу в ИИ-сервис для
          формирования отчёта. Я понимаю, что это добровольно.
        </span>
      </label>
    </div>
  );
}
