import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream, mkdirSync } from "node:fs";
import { mkdir, stat, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { WebSocketServer, type WebSocket } from "ws";
import {
  NodeSqliteWrapper,
  SQLiteSyncStorage,
  TLSocketRoom,
} from "@tldraw/sync-core";
import {
  hashPassword,
  verifyPassword,
  parseCookies,
  setCookie,
  newToken,
  hashToken,
  safeEqual,
} from "./auth.js";

const CREATE_CODE = process.env.CREATE_CODE;
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DAY = 24 * 60 * 60;

mkdirSync("data", { recursive: true });
const db = new Database("data/boards.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer'
  );
`);

type User = { id: number; login: string; name: string; password_hash: string };
type Board = { id: string; title: string; owner_id: number };
type Participant = { id: string; name: string; role: "editor" | "viewer" };

const q = {
  userByLogin: db.prepare("SELECT * FROM users WHERE login = ?"),
  userById: db.prepare("SELECT * FROM users WHERE id = ?"),
  insertUser: db.prepare(
    "INSERT INTO users (login, name, password_hash) VALUES (?, ?, ?)",
  ),
  insertSession: db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ),
  sessionUser: db.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ),
  insertBoard: db.prepare(
    "INSERT INTO boards (id, title, owner_id) VALUES (?, ?, ?)",
  ),
  boardById: db.prepare("SELECT id, title, owner_id FROM boards WHERE id = ?"),
  insertParticipant: db.prepare(
    "INSERT INTO participants (id, token_hash, board_id, name) VALUES (?, ?, ?, ?)",
  ),
  participantByToken: db.prepare(
    "SELECT id, name, role FROM participants WHERE token_hash = ? AND board_id = ?",
  ),
  participantsOfBoard: db.prepare(
    "SELECT id, name, role FROM participants WHERE board_id = ? ORDER BY rowid",
  ),
  setRole: db.prepare(
    "UPDATE participants SET role = ? WHERE id = ? AND board_id = ?",
  ),
  deleteParticipant: db.prepare(
    "DELETE FROM participants WHERE id = ? AND board_id = ?",
  ),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
};

// ---------- Кто это? ----------
type Who = {
  role: "owner" | "editor" | "viewer";
  name: string;
  userKey: string;
};

function whoIs(cookies: Record<string, string>, board: Board): Who | null {
  // 1. Учитель? Сессия по cookie sid, и этот пользователь владеет именно этой доской
  if (cookies.sid) {
    const s = q.sessionUser.get(hashToken(cookies.sid), Date.now()) as
      | { user_id: number }
      | undefined;
    if (s && s.user_id === board.owner_id) {
      const u = q.userById.get(s.user_id) as User;
      return { role: "owner", name: u.name, userKey: `u${u.id}` };
    }
  }
  // 2. Ученик? Токен в cookie p_<id доски>
  const token = cookies[`p_${board.id}`];
  if (token) {
    const p = q.participantByToken.get(hashToken(token), board.id) as
      | Participant
      | undefined;
    if (p) return { role: p.role, name: p.name, userKey: p.id };
  }
  return null;
}

function startSession(res: ServerResponse, userId: number) {
  const token = newToken();
  q.insertSession.run(hashToken(token), userId, Date.now() + 30 * DAY * 1000);
  setCookie(res, "sid", token, 30 * DAY);
}

// ---------- Комнаты ----------
const rooms = new Map<string, TLSocketRoom>();

function getRoom(roomId: string) {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const sql = new NodeSqliteWrapper(db, { tablePrefix: `room_${roomId}_` });
  const room = new TLSocketRoom({
    storage: new SQLiteSyncStorage({ sql }),
    onSessionRemoved(r, { numSessionsRemaining }) {
      if (numSessionsRemaining === 0) {
        r.close();
        rooms.delete(roomId);
      }
    },
  });
  rooms.set(roomId, room);
  return room;
}

// ---------- Открытые соединения ----------
// Кто сейчас подключён: ключ (id участника или учителя) -> его сокеты
const sockets = new Map<string, Set<WebSocket>>();

function trackSocket(key: string, socket: WebSocket) {
  const set = sockets.get(key) ?? new Set<WebSocket>();
  set.add(socket);
  sockets.set(key, set);
  socket.on("close", () => {
    set.delete(socket);
    if (set.size === 0) sockets.delete(key);
  });
}

function closeSockets(key: string, code: number, reason: string) {
  for (const s of sockets.get(key) ?? []) s.close(code, reason);
}

// ---------- Загрузка картинок ----------
const MAX_UPLOAD = 5 * 1024 * 1024; // 5 МБ
const MAX_BOARD_UPLOADS = 100 * 1024 * 1024; // всего 100 МБ картинок на одну доску

const IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;

// Определяем тип по первым байтам файла ("магическим числам"), а не по имени
function detectImage(b: Buffer): keyof typeof IMAGE_MIME | null {
  if (b.length < 12) return null;
  if (
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

// Читаем тело запроса, но не больше лимита
async function readBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function dirSize(dir: string) {
  try {
    let total = 0;
    for (const name of await readdir(dir))
      total += (await stat(join(dir, name))).size;
    return total;
  } catch {
    return 0; // папки ещё нет
  }
}

// ---------- HTTP ----------
function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const cookies = parseCookies(req.headers.cookie);

  // Создать доску (и при первом разе учительский аккаунт)
  if (req.method === "POST" && path === "/api/boards") {
    const b = await readJson(req);
    const title = text(b.title);
    const name = text(b.name);
    const login = text(b.login);
    const password = typeof b.password === "string" ? b.password : "";

    if (
      !title ||
      title.length > 100 ||
      !name ||
      name.length > 50 ||
      login.length < 3 ||
      login.length > 32 ||
      password.length < 8
    ) {
      return sendJson(res, 400, {
        error:
          "Проверьте поля: название и имя заполнены, логин от 3 символов, пароль от 8",
      });
    }

    // Если на сервере задан код создания, без него доски создавать нельзя
    if (CREATE_CODE) {
      const code = typeof b.code === "string" ? b.code : "";
      if (!safeEqual(code, CREATE_CODE)) {
        return sendJson(res, 403, { error: "Неверный код доступа" });
      }
    }

    let user = q.userByLogin.get(login) as User | undefined;
    if (user) {
      if (!(await verifyPassword(password, user.password_hash))) {
        return sendJson(res, 401, { error: "Неверный логин или пароль" });
      }
    } else {
      const hash = await hashPassword(password);
      const info = q.insertUser.run(login, name, hash);
      user = {
        id: Number(info.lastInsertRowid),
        login,
        name,
        password_hash: hash,
      };
    }

    const boardId = randomBytes(16).toString("hex");
    q.insertBoard.run(boardId, title, user.id);
    startSession(res, user.id);
    console.log("создана доска", boardId, "владелец", login);
    return sendJson(res, 200, { id: boardId });
  }

  // Вход учителя
  if (req.method === "POST" && path === "/api/login") {
    const b = await readJson(req);
    const user = q.userByLogin.get(text(b.login)) as User | undefined;
    const password = typeof b.password === "string" ? b.password : "";
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return sendJson(res, 401, { error: "Неверный логин или пароль" });
    }
    startSession(res, user.id);
    return sendJson(res, 200, { ok: true });
  }

  // Выход учителя
  if (req.method === "POST" && path === "/api/logout") {
    if (cookies.sid) q.deleteSession.run(hashToken(cookies.sid));
    setCookie(res, "sid", "", 0);
    return sendJson(res, 200, { ok: true });
  }

  // Маршруты конкретной доски
  const m = path.match(/^\/api\/boards\/([a-f0-9]{32})\/(me|join|leave)$/);
  if (m) {
    const board = q.boardById.get(m[1]) as Board | undefined;
    if (!board) return sendJson(res, 404, { error: "Доска не найдена" });

    // Кто я на этой доске?
    if (req.method === "GET" && m[2] === "me") {
      return sendJson(res, 200, {
        title: board.title,
        me: whoIs(cookies, board),
      });
    }

    // Ученик входит по имени
    if (req.method === "POST" && m[2] === "join") {
      const body = await readJson(req);
      const name = text(body.name);
      const remember = body.remember === true;
      if (!name || name.length > 50) {
        return sendJson(res, 400, { error: "Введите имя (до 50 символов)" });
      }
      const token = newToken();
      q.insertParticipant.run(
        randomBytes(8).toString("hex"),
        hashToken(token),
        board.id,
        name,
      );
      setCookie(res, `p_${board.id}`, token, remember ? 90 * DAY : undefined);
      return sendJson(res, 200, { ok: true });
    }

    // Ученик выходит с доски
    if (req.method === "POST" && m[2] === "leave") {
      const who = whoIs(cookies, board);
      if (who && who.role !== "owner") {
        q.deleteParticipant.run(who.userKey, board.id); // запись пропадёт из списка учителя
        closeSockets(who.userKey, 4002, "left");
      }
      setCookie(res, `p_${board.id}`, "", 0); // стираем cookie
      return sendJson(res, 200, { ok: true });
    }
  }

  // Картинки доски: загрузка и выдача
  const am = path.match(
    /^\/api\/boards\/([a-f0-9]{32})\/assets(?:\/([a-f0-9]{32}\.(?:png|jpg|gif|webp)))?$/,
  );
  if (am) {
    const board = q.boardById.get(am[1]) as Board | undefined;
    if (!board) return sendJson(res, 404, { error: "Доска не найдена" });

    const who = whoIs(cookies, board);
    if (!who) return sendJson(res, 403, { error: "Нет доступа" });

    const file = am[2];

    // Отдать картинку любому участнику доски
    if (req.method === "GET" && file) {
      const full = join("data", "uploads", board.id, file);
      try {
        await stat(full);
      } catch {
        return sendJson(res, 404, { error: "Файл не найден" });
      }
      const ext = file.split(".")[1] as keyof typeof IMAGE_MIME;
      res.writeHead(200, {
        "Content-Type": IMAGE_MIME[ext],
        "X-Content-Type-Options": "nosniff",
        // Имя случайное и содержимое не меняется, поэтому можно кэшировать надолго
        "Cache-Control": "private, max-age=31536000, immutable",
      });
      createReadStream(full).pipe(res);
      return;
    }

    // Загрузить картинку: владелец и редакторы
    if (req.method === "POST" && !file) {
      if (who.role === "viewer") {
        return sendJson(res, 403, { error: "Зрителям загрузка запрещена" });
      }
      if (Number(req.headers["content-length"] ?? 0) > MAX_UPLOAD) {
        return sendJson(res, 413, {
          error: `Файл больше ${MAX_UPLOAD / 1024 / 1024} МБ`,
        });
      }
      const body = await readBody(req, MAX_UPLOAD);
      if (!body)
        return sendJson(res, 413, {
          error: `Файл больше ${MAX_UPLOAD / 1024 / 1024} МБ`,
        });

      const ext = detectImage(body);
      if (!ext) {
        return sendJson(res, 415, {
          error: "Поддерживаются PNG, JPEG, GIF и WebP",
        });
      }

      const name = `${randomBytes(16).toString("hex")}.${ext}`;
      const dir = join("data", "uploads", board.id);
      if ((await dirSize(dir)) + body.length > MAX_BOARD_UPLOADS) {
        return sendJson(res, 413, {
          error: "Лимит картинок на этой доске исчерпан",
        });
      }
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), body);
      console.log(`картинка ${name} (${body.length} байт) от ${who.name}`);
      return sendJson(res, 200, {
        src: `/api/boards/${board.id}/assets/${name}`,
      });
    }
  }

  // Управление участниками: только владелец доски
  const pm = path.match(
    /^\/api\/boards\/([a-f0-9]{32})\/participants(?:\/([a-f0-9]{16})(\/role)?)?$/,
  );
  if (pm) {
    const board = q.boardById.get(pm[1]) as Board | undefined;
    if (!board) return sendJson(res, 404, { error: "Доска не найдена" });

    const who = whoIs(cookies, board);
    if (who?.role !== "owner")
      return sendJson(res, 403, { error: "Только для учителя" });

    const pid = pm[2];
    const isRolePath = Boolean(pm[3]);

    // Список участников
    if (req.method === "GET" && !pid) {
      const rows = q.participantsOfBoard.all(board.id) as Participant[];
      return sendJson(res, 200, {
        participants: rows.map((p) => ({ ...p, online: sockets.has(p.id) })),
      });
    }

    // Сменить роль
    if (req.method === "POST" && pid && isRolePath) {
      const role = (await readJson(req)).role;
      if (role !== "viewer" && role !== "editor") {
        return sendJson(res, 400, { error: "Роль: viewer или editor" });
      }
      const info = q.setRole.run(role, pid, board.id);
      if (info.changes === 0)
        return sendJson(res, 404, { error: "Участник не найден" });
      closeSockets(pid, 4001, "role changed"); // старая сессия умирает, новая получит новую роль
      return sendJson(res, 200, { ok: true });
    }

    // Удалить участника
    if (req.method === "DELETE" && pid && !isRolePath) {
      const info = q.deleteParticipant.run(pid, board.id);
      if (info.changes === 0)
        return sendJson(res, 404, { error: "Участник не найден" });
      closeSockets(pid, 4002, "removed");
      return sendJson(res, 200, { ok: true });
    }
  }
  res.writeHead(404);
  res.end();
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    sendJson(res, 500, { error: "Ошибка сервера" });
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost");
  const match = url.pathname.match(/^\/connect\/([a-f0-9]{32})$/);
  const sessionId = url.searchParams.get("sessionId");
  const board = match
    ? (q.boardById.get(match[1]) as Board | undefined)
    : undefined;

  if (
    ALLOWED_ORIGINS &&
    !ALLOWED_ORIGINS.includes(request.headers.origin ?? "")
  ) {
    socket.close(4403, "forbidden origin");
    return;
  }

  if (!board || !sessionId) {
    socket.close(4404, "not found");
    return;
  }

  // Роль определяет сервер, по cookie из запроса на подключение
  const who = whoIs(parseCookies(request.headers.cookie), board);
  if (!who) {
    socket.close(4401, "unauthorized");
    return;
  }

  console.log(`подключился ${who.name} (${who.role}) к доске ${board.id}`);
  trackSocket(who.userKey, socket);
  getRoom(board.id).handleSocketConnect({
    sessionId,
    socket,
    isReadonly: who.role === "viewer",
  });
});

server.listen(PORT, HOST, () =>
  console.log(`Сервер доски слушает ${HOST}:${PORT}`),
);

process.on("SIGINT", () => {
  console.log("останавливаюсь...");
  for (const room of rooms.values()) room.close();
  db.close();
  process.exit(0);
});
