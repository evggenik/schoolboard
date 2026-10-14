import { useState } from "react";

type Props = {
  title: string;
  roomId: string;
  onJoined: () => Promise<boolean>;
};

export default function JoinPage({ title, roomId, onJoined }: Props) {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);

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
    setError("");
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
      <h1>{title}</h1>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setMode("student")}
          disabled={mode === "student"}
        >
          Я ученик
        </button>{" "}
        <button
          onClick={() => setMode("teacher")}
          disabled={mode === "teacher"}
        >
          Я учитель
        </button>
      </div>

      {mode === "student" ? (
        <>
          <input
            style={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как вас зовут?"
          />
          <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{" "}
            Запомнить меня на этом устройстве
            <div style={{ color: "#666", fontSize: 12 }}>
              Только на своём телефоне или компьютере, не на школьном.
            </div>
          </label>
        </>
      ) : (
        <>
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
            placeholder="Пароль"
          />
        </>
      )}

      <button onClick={submit} style={{ padding: "8px 16px" }}>
        Войти
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
