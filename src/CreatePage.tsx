import { useState } from "react";

// Стили лежат здесь же, классы начинаются с cp-.
// Цвета в переменных: светлая и тёмная тема переключаются сами по настройке системы.
const css = `
.cp-page {
  --bg: #f1f4f9; --card: #ffffff; --ink: #1f2a37; --muted: #6b7280;
  --line: #dfe4ec; --field: #ffffff; --accent: #4f46e5; --accent-hover: #4338ca;
  --note-bg: #eef0ff; --err-bg: #fff1f1; --err: #c92a2a;
  min-height: 100vh; box-sizing: border-box; padding: 24px;
  display: grid; place-items: center;
  background: var(--bg); color: var(--ink);
  font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .cp-page {
    --bg: #12151c; --card: #1b2029; --ink: #e8ecf2; --muted: #9aa4b2;
    --line: #2c3441; --field: #141922; --accent: #6366f1; --accent-hover: #818cf8;
    --note-bg: rgba(99, 102, 241, .16); --err-bg: rgba(224, 49, 49, .14); --err: #ff8787;
  }
}
.cp-card {
  width: min(100%, 420px); box-sizing: border-box; padding: 28px 26px 24px;
  background: var(--card); border-radius: 18px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, .12), 0 0 0 1px var(--line);
}
.cp-logo {
  width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
  background: var(--accent); color: #fff; margin-bottom: 14px;
}
.cp-title { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 750; }
.cp-sub { margin: 6px 0 20px; color: var(--muted); }

.cp-label { display: block; margin: 0 0 6px; font-weight: 600; font-size: 13px; }
.cp-field {
  width: 100%; box-sizing: border-box; height: 46px; padding: 0 14px; margin-bottom: 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--field); color: var(--ink);
  font: inherit; outline: none; transition: border-color .15s ease, box-shadow .15s ease;
}
.cp-field::placeholder { color: var(--muted); opacity: .8; }
.cp-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
.cp-hint { margin: -8px 0 14px; color: var(--muted); font-size: 12.5px; }

.cp-note { margin: 2px 0 18px; padding: 10px 12px; border-radius: 10px; background: var(--note-bg); font-size: 13px; }

.cp-submit {
  width: 100%; height: 48px; border: 0; border-radius: 12px; cursor: pointer;
  background: var(--accent); color: #fff; font: inherit; font-weight: 700; font-size: 16px;
  transition: background-color .15s ease, opacity .15s ease;
}
.cp-submit:hover:not(:disabled) { background: var(--accent-hover); }
.cp-submit:disabled { opacity: .6; cursor: default; }

.cp-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--err-bg); color: var(--err); font-weight: 500; }

.cp-card button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .cp-field, .cp-submit { transition: none; }
}
`;

const PlusIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, name, login, password, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error ?? `Сервер ответил: ${res.status}`);
      window.location.href = `/board/${data.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
      setBusy(false);
    }
  }

  return (
    <div className="cp-page">
      <style>{css}</style>

      <form
        className="cp-card"
        onSubmit={(e) => {
          e.preventDefault(); // Enter в поле работает как нажатие «Создать доску»
          handleCreate();
        }}
      >
        <div className="cp-logo">
          <PlusIcon />
        </div>
        <h1 className="cp-title">Новая доска</h1>
        <p className="cp-sub">Ссылку на готовую доску вы отправите ученикам</p>

        <label className="cp-label" htmlFor="cp-name">
          Ваше имя
        </label>
        <input
          id="cp-name"
          className="cp-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как к вам обращаются на уроке"
          maxLength={50}
          autoComplete="name"
          autoFocus
        />

        <label className="cp-label" htmlFor="cp-title">
          Название доски
        </label>
        <input
          id="cp-title"
          className="cp-field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Английский 7А"
          maxLength={100}
        />

        <label className="cp-label" htmlFor="cp-login">
          Логин
        </label>
        <input
          id="cp-login"
          className="cp-field"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="От 3 символов"
          maxLength={32}
          autoComplete="username"
        />

        <label className="cp-label" htmlFor="cp-password">
          Пароль
        </label>
        <input
          id="cp-password"
          className="cp-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="От 8 символов"
          autoComplete="new-password"
        />

        <label className="cp-label" htmlFor="cp-code">
          Код доступа
        </label>
        <input
          id="cp-code"
          className="cp-field"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
        />
        <p className="cp-hint">Его знает администратор сервера.</p>

        <p className="cp-note">
          Если такой логин уже есть, введите его пароль: доска создастся в вашем
          аккаунте.
        </p>

        <button className="cp-submit" type="submit" disabled={busy}>
          {busy ? "Создаём…" : "Создать доску"}
        </button>

        {error && (
          <p className="cp-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}