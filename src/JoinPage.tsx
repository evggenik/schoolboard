import { useState } from "react";

type Props = {
  title: string;
  roomId: string;
  onJoined: () => Promise<boolean>;
};

// Стили лежат здесь же, классы начинаются с jp-.
// Цвета в переменных: светлая и тёмная тема переключаются сами по настройке системы.
const css = `
.jp-page {
  --bg: #f1f4f9; --card: #ffffff; --ink: #1f2a37; --muted: #6b7280;
  --line: #dfe4ec; --field: #ffffff; --seg: #eceff3; --accent: #4f46e5; --accent-hover: #4338ca;
  --err-bg: #fff1f1; --err: #c92a2a;
  min-height: 100vh; box-sizing: border-box; padding: 24px;
  display: grid; place-items: center;
  background: var(--bg); color: var(--ink);
  font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .jp-page {
    --bg: #12151c; --card: #1b2029; --ink: #e8ecf2; --muted: #9aa4b2;
    --line: #2c3441; --field: #141922; --seg: #262d3a; --accent: #6366f1; --accent-hover: #818cf8;
    --err-bg: rgba(224, 49, 49, .14); --err: #ff8787;
  }
}
.jp-card {
  width: min(100%, 400px); box-sizing: border-box; padding: 28px 26px 24px;
  background: var(--card); border-radius: 18px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, .12), 0 0 0 1px var(--line);
}
.jp-logo {
  width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
  background: var(--accent); color: #fff; margin-bottom: 14px;
}
.jp-title { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 750; overflow-wrap: anywhere; }
.jp-sub { margin: 6px 0 20px; color: var(--muted); }

.jp-seg { position: relative; display: flex; padding: 4px; border-radius: 999px; background: var(--seg); margin-bottom: 20px; }
.jp-thumb {
  position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px);
  border-radius: 999px; background: var(--card);
  box-shadow: 0 1px 4px rgba(15, 23, 42, .18); transition: transform .2s ease;
}
.jp-seg[data-mode="teacher"] .jp-thumb { transform: translateX(100%); }
.jp-seg button {
  position: relative; z-index: 1; flex: 1; height: 36px; border: 0; border-radius: 999px; background: none;
  font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; transition: color .2s ease;
}
.jp-seg button[aria-pressed="true"] { color: var(--ink); }

.jp-label { display: block; margin: 0 0 6px; font-weight: 600; font-size: 13px; }
.jp-field {
  width: 100%; box-sizing: border-box; height: 46px; padding: 0 14px; margin-bottom: 14px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--field); color: var(--ink);
  font: inherit; outline: none; transition: border-color .15s ease, box-shadow .15s ease;
}
.jp-field::placeholder { color: var(--muted); opacity: .8; }
.jp-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }

.jp-remember { display: flex; gap: 10px; align-items: flex-start; margin: 2px 0 18px; cursor: pointer; }
.jp-remember input { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--accent); cursor: pointer; }
.jp-remember small { display: block; margin-top: 2px; color: var(--muted); font-size: 12.5px; }

.jp-submit {
  width: 100%; height: 48px; border: 0; border-radius: 12px; cursor: pointer;
  background: var(--accent); color: #fff; font: inherit; font-weight: 700; font-size: 16px;
  transition: background-color .15s ease, opacity .15s ease;
}
.jp-submit:hover:not(:disabled) { background: var(--accent-hover); }
.jp-submit:disabled { opacity: .6; cursor: default; }

.jp-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--err-bg); color: var(--err); font-weight: 500; }

.jp-card button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .jp-thumb, .jp-seg button, .jp-field, .jp-submit { transition: none; }
}
`;

const PencilIcon = () => (
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
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export default function JoinPage({ title, roomId, onJoined }: Props) {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  // Пока запрос идёт, повторное нажатие блокируем: иначе двойной клик
  // создал бы на сервере двух одинаковых участников
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Ошибка ${res.status}`);
    }
  }

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "student") {
        await post(`/api/boards/${roomId}/join`, { name, remember });
      } else {
        await post("/api/login", { login, password });
      }
      const ok = await onJoined();
      if (!ok) setError("Вы вошли, но эта доска принадлежит другому учителю");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: "student" | "teacher") {
    setMode(next);
    setError("");
  }

  return (
    <div className="jp-page">
      <style>{css}</style>

      <form
        className="jp-card"
        onSubmit={(e) => {
          e.preventDefault(); // Enter в поле работает как нажатие «Войти»
          submit();
        }}
      >
        <div className="jp-logo">
          <PencilIcon />
        </div>
        <h1 className="jp-title">{title}</h1>
        <p className="jp-sub">
          {mode === "student"
            ? "Введите имя, чтобы войти на доску"
            : "Войдите, чтобы управлять доской"}
        </p>

        <div className="jp-seg" data-mode={mode} role="group" aria-label="Кто вы">
          <span className="jp-thumb" />
          <button
            type="button"
            aria-pressed={mode === "student"}
            onClick={() => switchMode("student")}
          >
            Я ученик
          </button>
          <button
            type="button"
            aria-pressed={mode === "teacher"}
            onClick={() => switchMode("teacher")}
          >
            Я учитель
          </button>
        </div>

        {mode === "student" ? (
          <>
            <label className="jp-label" htmlFor="jp-name">
              Ваше имя
            </label>
            <input
              id="jp-name"
              className="jp-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как вас зовут?"
              maxLength={20}
              autoComplete="given-name"
              autoFocus
            />
            <label className="jp-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>
                Запомнить меня на этом устройстве
                <small>Только на своём телефоне или компьютере, не на школьном.</small>
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="jp-label" htmlFor="jp-login">
              Логин
            </label>
            <input
              id="jp-login"
              className="jp-field"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoFocus
            />
            <label className="jp-label" htmlFor="jp-password">
              Пароль
            </label>
            <input
              id="jp-password"
              className="jp-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </>
        )}

        <button className="jp-submit" type="submit" disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </button>

        {error && (
          <p className="jp-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}