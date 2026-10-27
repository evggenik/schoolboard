import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Participant = {
  id: string;
  name: string;
  role: "viewer" | "editor";
  online: boolean;
};

const json = { "Content-Type": "application/json" };

// Стили лежат прямо в компоненте, чтобы файл можно было просто заменить.
// Все классы начинаются с tp-, чтобы не пересекаться с tldraw.
const css = `
.tp-panel {
  position: absolute; top: 8px; right: 240px; width: 310px; max-height: 60vh;
  overflow-y: auto; z-index: 1000; box-sizing: border-box;
  background: #fff; color: #1f2a37; border-radius: 14px; padding: 12px 12px 8px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, .22), 0 0 0 1px rgba(15, 23, 42, .06);
  font: 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tp-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px 8px; }
.tp-title { font-size: 15px; font-weight: 700; }
.tp-count { font-size: 12px; color: #6b7280; }
.tp-error { color: #c92a2a; margin: 6px 2px; }
.tp-empty { color: #6b7280; margin: 10px 2px 6px; }

.tp-row { display: flex; align-items: center; gap: 9px; padding: 7px 2px; border-top: 1px solid #eef1f5; }
.tp-row[data-online="false"] { opacity: .55; }

.tp-avatar {
  position: relative; flex: none; width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px;
}
.tp-dot {
  position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px;
  border-radius: 50%; background: #adb5bd; box-shadow: 0 0 0 2px var(--tp-panel, #fff);
}
.tp-row[data-online="true"] .tp-dot { background: #2f9e44; }

.tp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }

/* Переключатель «просмотр / рисование» с ползунком */
.tp-seg { position: relative; flex: none; display: flex; padding: 3px; border-radius: 999px; background: #eceff3; }
.tp-thumb {
  position: absolute; top: 3px; left: 3px; width: 34px; height: 28px; border-radius: 999px;
  background: #475569; transition: transform .18s ease, background-color .18s ease;
}
.tp-seg[data-role="editor"] .tp-thumb { transform: translateX(34px); background: #f08c00; }
.tp-seg button {
  position: relative; z-index: 1; width: 34px; height: 28px; padding: 0; border: 0; border-radius: 999px;
  background: none; cursor: pointer; display: grid; place-items: center; color: #64748b;
  transition: color .18s ease;
}
.tp-seg button[aria-pressed="true"] { color: #fff; cursor: default; }
.tp-seg button:not([aria-pressed="true"]):hover { color: #1f2a37; }

.tp-del {
  flex: none; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px;
  background: none; color: #9aa3af; cursor: pointer; display: grid; place-items: center;
}
.tp-del:hover { background: #ffe3e3; color: #c92a2a; }

.tp-panel.tp-dark {
  background: #2c3036; color: #f8f9fa;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255, 255, 255, .09);
}
.tp-dark .tp-count, .tp-dark .tp-empty { color: #9aa4b2; }
.tp-dark .tp-error { color: #ff8787; }
.tp-dark .tp-row { border-top-color: #3d444c; }
.tp-dark .tp-dot { box-shadow: 0 0 0 2px var(--tp-panel, #2c3036); }
.tp-dark .tp-seg { background: #3d444c; }
.tp-dark .tp-thumb { background: #64748b; }
.tp-dark .tp-seg[data-role="editor"] .tp-thumb { background: #f08c00; }
.tp-dark .tp-seg button { color: #9aa4b2; }
.tp-dark .tp-seg button[aria-pressed="true"] { color: #fff; }
.tp-dark .tp-seg button:not([aria-pressed="true"]):hover { color: #f8f9fa; }
.tp-dark .tp-del { color: #868e96; }
.tp-dark .tp-del:hover { background: rgba(224, 49, 49, .22); color: #ff8787; }
.tp-panel button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .tp-thumb, .tp-seg button { transition: none; }
}
`;

// Панель стоит вне tldraw и не получает его тему сама, поэтому смотрим на класс контейнера доски:
// tldraw ставит на него tl-theme__dark в тёмной теме и tl-theme__light в светлой.
function useTldrawTheme() {
  const read = () => {
    const el = document.querySelector(".tl-container");
    const cs = el ? getComputedStyle(el) : null;
    // Переменная называется по-разному в разных версиях tldraw, пробуем оба имени
    const pick = (names: string[]) =>
      names.map((n) => cs?.getPropertyValue(n).trim()).find(Boolean) || undefined;
    return {
      dark: !!document.querySelector(".tl-theme__dark"),
      panel: pick(["--tl-color-panel", "--color-panel"]),
      text: pick(["--tl-color-text", "--color-text"]),
    };
  };
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const target = document.querySelector(".tl-container") ?? document.body;
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    setTheme(read());
    return () => observer.disconnect();
  }, []);

  return theme;
}

// Цвет аватарки зависит от имени: у одного человека он всегда одинаковый
function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

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
  const theme = useTldrawTheme();

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
  const onlineCount = list.filter((p) => p.online).length;

  return (
    <div
      ref={ref}
      className={theme.dark ? "tp-panel tp-dark" : "tp-panel"}
      style={
        {
          // Цвет панели берём у самого tldraw, чтобы она совпадала с карточкой пользователя
          "--tp-panel": theme.panel,
          background: theme.panel,
          color: theme.text,
        } as CSSProperties
      }
    >
      <style>{css}</style>

      <div className="tp-head">
        <span className="tp-title">Участники</span>
        {list.length > 0 && (
          <span className="tp-count">{onlineCount} в сети</span>
        )}
      </div>

      {error && <p className="tp-error">{error}</p>}
      {sorted.length === 0 && !error && (
        <p className="tp-empty">Пока никого. Отправьте ученикам ссылку на доску.</p>
      )}

      {sorted.map((p) => (
        <div key={p.id} className="tp-row" data-online={p.online}>
          <span
            className="tp-avatar"
            style={{ background: avatarColor(p.name) }}
            title={p.online ? "В сети" : "Не в сети"}
          >
            {p.name.trim().charAt(0).toUpperCase()}
            <span className="tp-dot" />
          </span>

          <span className="tp-name" title={p.name}>
            {p.name}
          </span>

          <div className="tp-seg" data-role={p.role} role="group" aria-label="Права">
            <span className="tp-thumb" />
            <button
              aria-pressed={p.role === "viewer"}
              onClick={() => p.role !== "viewer" && setRole(p.id, "viewer")}
              title="Только смотрит"
            >
              <EyeIcon />
            </button>
            <button
              aria-pressed={p.role === "editor"}
              onClick={() => p.role !== "editor" && setRole(p.id, "editor")}
              title="Может рисовать"
            >
              <PencilIcon />
            </button>
          </div>

          <button
            className="tp-del"
            onClick={() => remove(p.id, p.name)}
            title="Удалить с доски"
            aria-label={`Удалить ${p.name}`}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}