import { useState } from "react";

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  async function handleCreate() {
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

  const field = {
    width: "100%",
    padding: 8,
    boxSizing: "border-box",
    marginBottom: 8,
  } as const;

  return (
    <div
      style={{ maxWidth: 400, margin: "60px auto", fontFamily: "sans-serif" }}
    >
      <h1>Новая доска</h1>
      <input
        style={field}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ваше имя"
      />
      <input
        style={field}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название доски (Английский 7А)"
      />
      <input
        style={field}
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        placeholder="Логин"
      />
      <input
        style={field}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль (от 8 символов)"
      />
      <input
        style={field}
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Код доступа (его знает администратор)"
      />
      <button
        onClick={handleCreate}
        disabled={busy}
        style={{ padding: "8px 16px" }}
      >
        Создать доску
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p style={{ color: "#666", fontSize: 14 }}>
        Если такой логин уже есть, введите его пароль: доска создастся в вашем
        аккаунте.
      </p>
    </div>
  );
}
