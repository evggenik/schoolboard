import { useCallback, useEffect, useRef, useState } from "react";

type Participant = {
  id: string;
  name: string;
  role: "viewer" | "editor";
  online: boolean;
};

const json = { "Content-Type": "application/json" };

export default function TeacherPanel({
  roomId,
  onClose,
}: {
  roomId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<Participant[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${roomId}/participants`);
      if (!res.ok) throw new Error();
      setList((await res.json()).participants);
      setError("");
    } catch {
      setError("Нет связи с сервером");
    }
  }, [roomId]);

  // Закрытие: клик вне панели или Escape
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return; // клик внутри панели
      if (target.closest("[data-teacher-toggle]")) return; // кнопку обработает она сама
      onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // true: ловим событие раньше tldraw, который мог бы его "съесть"
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // Опрос раз в 3 секунды, пока панель открыта
  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  async function setRole(id: string, role: "viewer" | "editor") {
    await fetch(`/api/boards/${roomId}/participants/${id}/role`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Удалить «${name}» с доски?`)) return;
    await fetch(`/api/boards/${roomId}/participants/${id}`, {
      method: "DELETE",
    });
    load();
  }

  // Сначала те, кто в сети
  const sorted = [...list].sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 8,
        right: 240, // слева от блока «Вы:», не накрывая его
        width: 280,
        maxHeight: "60vh",
        overflowY: "auto",
        zIndex: 1000,
        background: "white",
        color: "#222",
        borderRadius: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        padding: 10,
        fontFamily: "sans-serif",
        fontSize: 13,
      }}
    >
      <b>Участники</b>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {sorted.length === 0 && !error && (
        <p style={{ color: "#777" }}>Пока никого</p>
      )}

      {sorted.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            opacity: p.online ? 1 : 0.5,
          }}
        >
          <span
            title={p.online ? "В сети" : "Не в сети"}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.online ? "#2f9e44" : "#adb5bd",
            }}
          />
          <span
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {p.name}
          </span>

          <button
            onClick={() => setRole(p.id, "viewer")}
            disabled={p.role === "viewer"}
            title="Только просмотр"
          >
            👁
          </button>
          <button
            onClick={() => setRole(p.id, "editor")}
            disabled={p.role === "editor"}
            title="Может рисовать"
          >
            ✏
          </button>
          <button onClick={() => remove(p.id, p.name)} title="Удалить с доски">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
