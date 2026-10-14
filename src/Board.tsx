import { useEffect, useMemo, useState } from "react";
import {
  Tldraw,
  computed,
  createUserId,
  UserRecordType,
  type TLUserStore,
} from "tldraw";
import { useSync } from "@tldraw/sync";
import { getAssetUrlsByMetaUrl } from "@tldraw/assets/urls";
import type { Me } from "./types";
import { BoardContext, peopleComponents } from "./PeopleList";
import TeacherPanel from "./TeacherPanel";
import { createAssetStore } from "./assets";

import "tldraw/tldraw.css";

const assetUrls = getAssetUrlsByMetaUrl();

// Цвет курсора выбираем по id пользователя, чтобы у одного человека он всегда был одинаковый
const COLORS = [
  "#e03131",
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#e8590c",
  "#5c940d",
];

function colorFor(key: string) {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

const wsBase = import.meta.env.DEV
  ? `ws://${location.hostname}:3001`
  : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

export default function Board({ roomId, me }: { roomId: string; me: Me }) {
  // computed: значение, которое tldraw умеет отслеживать. useMemo: не создавать заново при каждой перерисовке
  const users: TLUserStore = useMemo(
    () => ({
      currentUser: computed("currentUser", () =>
        UserRecordType.create({
          id: createUserId(me.userKey),
          name: me.name,
          color: colorFor(me.userKey),
        }),
      ),
    }),
    [me.userKey, me.name],
  );

  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Стабильный объект: создаётся один раз на доску, а не при каждой перерисовке
  const assets = useMemo(() => createAssetStore(roomId, setNotice), [roomId]);

  const store = useSync({
    uri: `${wsBase}/connect/${roomId}`,
    assets,
    users,
  });
  const [panelOpen, setPanelOpen] = useState(false);

  const ctx = useMemo(
    () => ({
      me,
      roomId,
      panelOpen,
      togglePanel: () => setPanelOpen((o) => !o),
    }),
    [me, roomId, panelOpen],
  );

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <BoardContext.Provider value={ctx}>
        <Tldraw
          licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
          store={store}
          assetUrls={assetUrls}
          components={peopleComponents}
          onMount={(editor) => {
            editor.updateInstanceState({ isReadonly: me.role === "viewer" });
          }}
        />
      </BoardContext.Provider>
      {me.role === "owner" && panelOpen && (
        <TeacherPanel roomId={roomId} onClose={() => setPanelOpen(false)} />
      )}
      {notice && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#c92a2a",
            color: "white",
            padding: "8px 14px",
            borderRadius: 8,
            fontFamily: "sans-serif",
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      )}
    </div>
  );
}
