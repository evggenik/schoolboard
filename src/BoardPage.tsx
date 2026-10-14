import { useCallback, useEffect, useState } from "react";
import Board from "./Board";
import JoinPage from "./JoinPage";
import type { Me } from "./types";

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error" }
  | { status: "ready"; title: string; me: Me | null };

function sameMe(a: Me | null, b: Me | null) {
  if (a === null || b === null) return a === b;
  return a.role === b.role && a.name === b.name && a.userKey === b.userKey;
}

export default function BoardPage({ roomId }: { roomId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  // Спрашиваем у сервера: что это за доска и кто я на ней?
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/boards/${roomId}/me`);
      if (res.status === 404) {
        setState({ status: "notfound" });
        return false;
      }
      const data = await res.json();
      const me: Me | null = data.me;
      setState((prev) =>
        prev.status === "ready" &&
        prev.title === data.title &&
        sameMe(prev.me, me)
          ? prev
          : { status: "ready", title: data.title, me },
      );
      return me !== null;
    } catch {
      return false;
    }
  }, [roomId]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [state.status, load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state.status === "ready") document.title = state.title;
  }, [state]);

  if (state.status === "loading") return <p>Загрузка…</p>;
  if (state.status === "notfound") return <p>Такой доски нет</p>;
  if (state.status === "error") return <p>Не удалось связаться с сервером</p>;
  if (!state.me)
    return <JoinPage title={state.title} roomId={roomId} onJoined={load} />;
  return <Board key={state.me.role} roomId={roomId} me={state.me} />;
}
