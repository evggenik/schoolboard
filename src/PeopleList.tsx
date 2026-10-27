import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useEditor, useValue, type TLComponents } from "tldraw";
import type { Me } from "./types";

export type BoardContextValue = {
  me: Me;
  roomId: string;
  panelOpen: boolean;
  togglePanel: () => void;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

const ROLE_LABEL = {
  owner: "учитель",
  editor: "редактор",
  viewer: "зритель",
} as const;

// Цвет привязан к роли, как в панели учителя:
// зритель спокойный серый, редактор оранжевый, учитель индиго.
const ROLE_COLOR = {
  owner: "#4f46e5",
  editor: "#f08c00",
  viewer: "#64748b",
} as const;

const COLLAPSE_KEY = "schoolboard-card-collapsed";

// Стили лежат здесь же, классы начинаются с sp-, чтобы не пересекаться с tldraw.
// Цвета берём из переменных tldraw, поэтому светлая и тёмная тема работают сами.
const css = `
/* Фон и цвет текста берём из переменных tldraw, но с запасным значением:
   если переменной с таким именем в этой версии tldraw нет, фон всё равно будет сплошным. */
.sp-card {
  --sp-panel: var(--tl-color-panel, var(--color-panel, #ffffff));
  --sp-text: var(--tl-color-text, var(--color-text, #1f2a37));
  pointer-events: all; box-sizing: border-box; max-width: 240px; min-width: 200px;
  padding: 10px; border-radius: 14px;
  background: var(--sp-panel); color: var(--sp-text);
  box-shadow: 0 6px 22px rgba(15, 23, 42, .18), 0 0 0 1px rgba(128, 128, 128, .18);
  font: 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tl-theme__dark .sp-card {
  --sp-panel: var(--tl-color-panel, var(--color-panel, #212529));
  --sp-text: var(--tl-color-text, var(--color-text, #f0f1f3));
}
.sp-me { display: flex; align-items: center; gap: 9px; }
.sp-avatar {
  flex: none; width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px;
  background: var(--c);
}
.sp-me-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sp-me-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-badge {
  align-self: flex-start; padding: 1px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600; color: #fff; background: var(--c);
}
.sp-fold {
  flex: none; align-self: flex-start; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 8px;
  display: grid; place-items: center; cursor: pointer; background: none;
  color: var(--color-text-3, #868e96);
}
.sp-fold:hover { background: var(--color-muted-2, rgba(128, 128, 128, .14)); color: var(--sp-text); }

.sp-actions { display: flex; gap: 6px; margin-top: 10px; }
.sp-actions + .sp-actions { margin-top: 6px; }
.sp-btn {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; padding: 0 10px; border: 0; border-radius: 9px; cursor: pointer;
  font: inherit; font-weight: 600; color: var(--sp-text);
  background: var(--color-muted-2, rgba(128, 128, 128, .14));
  transition: background-color .15s ease, color .15s ease;
}
.sp-btn:hover { background: var(--color-muted-1, rgba(128, 128, 128, .24)); }
.sp-btn[aria-pressed="true"] { background: #4f46e5; color: #fff; }
.sp-btn.sp-exit:hover { background: rgba(224, 49, 49, .16); color: #e03131; }
.sp-btn.sp-present[aria-pressed="true"] { background: #0c8599; animation: sp-pulse 1.8s ease-out infinite; --c: #0c8599; }

.sp-btn.sp-back { background: rgba(240, 140, 0, .18); color: #c2410c; }
.sp-btn.sp-back:hover { background: rgba(240, 140, 0, .3); }
.sp-live { margin: 8px 2px 0; font-weight: 600; color: #0c8599; }
.sp-tag { flex: none; margin-left: auto; display: inline-flex; align-items: center; color: #2f9e44; }
.sp-tag.sp-lag { padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #c2410c; background: rgba(240, 140, 0, .18); }
.sp-debug { margin: 8px 0 0; padding: 6px; border-radius: 8px; max-height: 200px; overflow: auto; user-select: text;
  font: 10px/1.3 ui-monospace, monospace; white-space: pre-wrap; word-break: break-all;
  background: var(--color-muted-2, rgba(128, 128, 128, .14)); }

.sp-list { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--color-divider, rgba(128, 128, 128, .25)); }
.sp-empty { margin: 6px 2px 2px; color: var(--color-text-3, #868e96); }
.sp-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.sp-person {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
  padding: 4px 6px; border: 0; border-radius: 9px; cursor: pointer;
  background: none; color: inherit; font: inherit; text-align: left;
}
.sp-person:hover { background: var(--color-muted-2, rgba(128, 128, 128, .14)); }
.sp-person .sp-avatar { width: 24px; height: 24px; font-size: 11px; }
.sp-person-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sp-follow {
  flex: none; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 9px; cursor: pointer;
  display: grid; place-items: center; background: none; color: var(--color-text-3, #868e96);
  transition: background-color .15s ease, color .15s ease;
}
.sp-follow:hover { background: var(--color-muted-2, rgba(128, 128, 128, .14)); color: var(--sp-text); }
.sp-follow[aria-pressed="true"] { background: var(--c); color: #fff; animation: sp-pulse 1.8s ease-out infinite; }

/* Свёрнутая карточка: круг с аватаркой */
.sp-circle {
  pointer-events: all; position: relative; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer; background: var(--c); color: #fff;
  font: 700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 6px 22px rgba(15, 23, 42, .22), 0 0 0 2px var(--sp-panel, #fff);
}
.sp-circle[data-live="true"] { animation: sp-pulse 1.8s ease-out infinite; }

@keyframes sp-pulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 55%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}

.sp-card button:focus-visible, .sp-circle:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .sp-btn.sp-present[aria-pressed="true"], .sp-follow[aria-pressed="true"], .sp-circle[data-live="true"] { animation: none; }
  .sp-btn, .sp-follow { transition: none; }
}
`;

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

const PeopleIcon = () => (
  <svg {...iconProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
  </svg>
);

const ExitIcon = () => (
  <svg {...iconProps}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </svg>
);

const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const BroadcastIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
  </svg>
);

const MinimizeIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12h14" />
  </svg>
);

const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

const RewindIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// Пока человек сам не выбрал, карточка свёрнута в круг: на телефоне она занимает много места.
// Если он развернул её, выбор запоминается ("0"), и дальше она открывается развёрнутой.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) !== "0";
  } catch {
    return true;
  }
}

function PeopleList() {
  const editor = useEditor();
  const ctx = useContext(BoardContext);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const prevPresenter = useRef<string | null>(null);

  const collaborators = useValue(
    "collaborators",
    () => editor.getCollaborators(),
    [editor],
  );
  const followingId = useValue(
    "following",
    () => editor.getInstanceState().followingUserId,
    [editor],
  );
  // Кто сейчас показывает доску всем. Это поле лежит в настройках документа,
  // поэтому синхронизируется само, как и рисунки. Писать в него может только тот,
  // кто умеет редактировать (то есть учитель), а читают все.
  // Храним имя учителя: внутренний id tldraw у каждого клиента свой и не совпадает
  // с тем id, под которым участника видят остальные (его выдаёт наш сервер).
  const presenterName = useValue(
    "presenter",
    () => {
      const v = editor.getDocumentSettings().meta?.presenterName;
      return typeof v === "string" ? v : null;
    },
    [editor],
  );

  // Счётчик «вернуть отставших»: учитель увеличивает его на 1, и у учеников,
  // которые оторвались от показа, слежение включается заново.
  const presenterPing = useValue(
    "presenterPing",
    () => {
      const v = editor.getDocumentSettings().meta?.presenterPing;
      return typeof v === "number" ? v : 0;
    },
    [editor],
  );

  const role = ctx?.me.role;
  // Учитель среди участников, как его видит этот клиент
  const presenter = presenterName
    ? collaborators.find((c) => c.userName === presenterName)
    : undefined;
  const presenterUserId = presenter?.userId ?? null;
  const presenterHere = presenterUserId !== null;

  // У учеников: когда учитель включил показ, подключаемся к его экрану;
  // когда выключил, перестаём следить, но только если следили именно за ним.
  // Если ученик сам оторвался от учителя, силой его не возвращаем.
  useEffect(() => {
    if (!role || role === "owner") return;
    const current = editor.getInstanceState().followingUserId;
    if (presenterUserId) {
      if (current !== presenterUserId) editor.startFollowingUser(presenterUserId);
    } else if (prevPresenter.current && current === prevPresenter.current) {
      editor.stopFollowingUser();
    }
    prevPresenter.current = presenterUserId;
  }, [editor, role, presenterUserId, presenterPing]); // presenterPing: сигнал «вернуть отставших»

  if (!ctx) return null;

  const { me, roomId, panelOpen, togglePanel } = ctx;
  const roleColor = { "--c": ROLE_COLOR[me.role] } as CSSProperties;

  const iAmPresenting = me.role === "owner" && presenterName === me.name;

  function togglePresenting() {
    const meta = editor.getDocumentSettings().meta;
    if (!iAmPresenting) editor.stopFollowingUser();
    editor.updateDocumentSettings({
      meta: {
        ...meta,
        presenterUserId: null, // старое поле, больше не используется
        presenterName: iAmPresenting ? null : me.name,
      },
    });
  }

  function bringBack() {
    const meta = editor.getDocumentSettings().meta;
    const current = typeof meta?.presenterPing === "number" ? meta.presenterPing : 0;
    editor.updateDocumentSettings({ meta: { ...meta, presenterPing: current + 1 } });
  }

  function setFolded(value: boolean) {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      // без сохранения тоже работает
    }
  }

  async function logout() {
    await fetch(
      me.role === "owner" ? "/api/logout" : `/api/boards/${roomId}/leave`,
      {
        method: "POST",
      },
    );
    window.location.reload(); // после перезагрузки сервер скажет "ты никто", и появится экран входа
  }

  // Один человек в нескольких вкладках показывается один раз
  const people = [...new Map(collaborators.map((c) => [c.userId, c])).values()];

  // Кто из участников сейчас смотрит на экран учителя.
  // Каждый участник сообщает остальным, за кем он следит (followingUserId).
  // Учитель в своём списке себя не видит, поэтому его id для остальных берём из
  // me.userKey (сервер выдаёт id участников в виде "user:<userKey>").
  // Если userKey нет, считаем так: следит за тем, кого нет в списке, значит за учителем.
  const myUserKey = (me as unknown as { userKey?: string }).userKey;
  const knownIds = new Set(people.map((c) => c.userId));
  const followsMe = (c: (typeof people)[number]) =>
    c.followingUserId != null &&
    (myUserKey
      ? c.followingUserId === `user:${myUserKey}`
      : !knownIds.has(c.followingUserId));
  const followers = people.filter(followsMe).length;
  const lagging = people.length - followers;

  // Диагностика: включается, если к адресу страницы добавить ?debug
  const debug = new URLSearchParams(window.location.search).has("debug");
  const debugText = JSON.stringify(
    {
      role: me.role,
      presenterName,
      presenterUserId,
      presenterPing,
      followingId,
      myUserKey,
      followers,
      lagging,
      collaborators: collaborators.map((c) => ({
        id: c.userId,
        name: c.userName,
        following: c.followingUserId,
        followsMe: followsMe(c),
      })),
    },
    null,
    1,
  );

  // Круг пульсирует, если вы показываете доску или следите за кем-то
  const live = iAmPresenting || followingId !== null;

  if (collapsed) {
    return (
      <div className="tlui-share-zone" draggable={false}>
        <style>{css}</style>
        <button
          className="sp-circle"
          style={roleColor}
          data-live={live}
          onClick={() => setFolded(false)}
          title="Развернуть панель"
          aria-label="Развернуть панель"
        >
          {initial(me.name)}
        </button>
      </div>
    );
  }

  return (
    <div className="tlui-share-zone" draggable={false}>
      <style>{css}</style>

      <div className="sp-card">
        <div className="sp-me" style={roleColor}>
          <span className="sp-avatar">{initial(me.name)}</span>
          <div className="sp-me-text">
            <span className="sp-me-name" title={me.name}>
              {me.name}
            </span>
            <span className="sp-badge">{ROLE_LABEL[me.role]}</span>
          </div>
          <button
            className="sp-fold"
            onClick={() => setFolded(true)}
            title="Свернуть"
            aria-label="Свернуть панель"
          >
            <MinimizeIcon />
          </button>
        </div>

        <div className="sp-actions">
          {me.role === "owner" && (
            <button
              className="sp-btn"
              data-teacher-toggle
              aria-pressed={panelOpen}
              onClick={togglePanel}
            >
              <PeopleIcon />
              Участники
            </button>
          )}
          <button className="sp-btn sp-exit" onClick={logout}>
            <ExitIcon />
            Выйти
          </button>
        </div>

        {me.role === "owner" && (
          <div className="sp-actions">
            <button
              className="sp-btn sp-present"
              aria-pressed={iAmPresenting}
              onClick={togglePresenting}
              title={
                iAmPresenting
                  ? "Ученики снова могут смотреть куда хотят"
                  : "Экраны учеников будут повторять ваш"
              }
            >
              <BroadcastIcon />
              {iAmPresenting
                ? people.length > 0
                  ? `Показ идёт: ${followers} из ${people.length}`
                  : "Показ идёт"
                : "Все смотрят на меня"}
            </button>
          </div>
        )}

        {iAmPresenting && lagging > 0 && (
          <div className="sp-actions">
            <button
              className="sp-btn sp-back"
              onClick={bringBack}
              title="Снова подключить к вашему экрану тех, кто отстал"
            >
              <RewindIcon />
              Вернуть отставших ({lagging})
            </button>
          </div>
        )}

        {me.role !== "owner" && presenterHere && (
          <p className="sp-live">Учитель показывает доску</p>
        )}

        <div className="sp-list">
          {people.length === 0 && <p className="sp-empty">Пока вы здесь одни</p>}

          {people.map((c) => {
            const following = followingId === c.userId;
            const name = c.userName || "Гость";
            return (
              <div
                key={c.userId}
                className="sp-row"
                style={{ "--c": c.color } as CSSProperties}
              >
                <button
                  className="sp-person"
                  onClick={() => editor.zoomToUser(c.userId)}
                  title="Перейти к курсору"
                >
                  <span className="sp-avatar">{initial(name)}</span>
                  <span className="sp-person-name">{name}</span>
                  {iAmPresenting &&
                    (followsMe(c) ? (
                      <span className="sp-tag" title="Смотрит на ваш экран">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span
                        className="sp-tag sp-lag"
                        title="Не следит за вашим экраном"
                      >
                        отстал
                      </span>
                    ))}
                </button>
                <button
                  className="sp-follow"
                  aria-pressed={following}
                  onClick={() =>
                    following
                      ? editor.stopFollowingUser()
                      : editor.startFollowingUser(c.userId)
                  }
                  title={following ? "Перестать следить" : "Следить за экраном"}
                >
                  <EyeIcon />
                </button>
              </div>
            );
          })}
        </div>

        {debug && <pre className="sp-debug">{debugText}</pre>}
      </div>
    </div>
  );
}

export const peopleComponents: TLComponents = { SharePanel: PeopleList };