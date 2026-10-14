import { createContext, useContext } from "react";
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

function PeopleList() {
  const editor = useEditor();
  const ctx = useContext(BoardContext);

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

  if (!ctx) return null;

  const { me, roomId, panelOpen, togglePanel } = ctx;

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

  return (
    <div className="tlui-share-zone" draggable={false}>
      <div
        style={{
          pointerEvents: "all",
          background: "var(--color-panel)",
          color: "var(--color-text)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 13,
          maxWidth: 220,
        }}
      >
                <div>
          <b>Вы:</b> {me.name} ({ROLE_LABEL[me.role]})
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {me.role === 'owner' && (
            <button
              data-teacher-toggle
              onClick={togglePanel}
              style={{ flex: 1, cursor: 'pointer', fontWeight: panelOpen ? 700 : 400 }}
            >
              Участники
            </button>
          )}
          <button onClick={logout} style={{ flex: 1, cursor: 'pointer' }}>
            Выйти
          </button>
        </div>

        {people.map((c) => {
          const following = followingId === c.userId;
          return (
            <div
              key={c.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              <div
                onClick={() => editor.zoomToUser(c.userId)}
                style={{ flex: 1, cursor: "pointer" }}
                title="Перейти к курсору"
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: c.color,
                    marginRight: 6,
                  }}
                />
                {c.userName || "Гость"}
              </div>
              <button
                onClick={() =>
                  following
                    ? editor.stopFollowingUser()
                    : editor.startFollowingUser(c.userId)
                }
                title={following ? "Перестать следить" : "Следить за экраном"}
                style={{
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 6px",
                  cursor: "pointer",
                  background: following ? c.color : "transparent",
                  color: following ? "white" : "inherit",
                }}
              >
                👁
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const peopleComponents: TLComponents = { SharePanel: PeopleList };
