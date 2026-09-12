export function WaitingScreen() {
  return (
    <div className="container center">
      <h1>Собираем твой отчёт…</h1>
      <div className="spinner" />
      <p className="lead">
        ИИ анализирует ответы, считает профиль и подбирает профессии, а затем пишет твой персональный
        разбор. Это занимает примерно минуту-две — не закрывай страницу.
      </p>
      <p className="note">Отчёт сохранится по личной ссылке — сможешь вернуться к нему позже.</p>
    </div>
  );
}
