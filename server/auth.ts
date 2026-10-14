import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { ServerResponse } from "node:http";

// ---------- Пароли ----------
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16); // "соль": у одинаковых паролей разные хеши
    scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt.toString("hex")}:${key.toString("hex")}`);
    });
  });
}

export function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [saltHex, keyHex] = stored.split(":");
    scrypt(password, Buffer.from(saltHex, "hex"), 64, (err, key) => {
      if (err) return reject(err);
      // timingSafeEqual сравнивает за одинаковое время, чтобы не выдавать совпавшие байты
      resolve(timingSafeEqual(key, Buffer.from(keyHex, "hex")));
    });
  });
}

// ---------- Токены ----------
export const newToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
// Сравнение строк за одинаковое время (хешируем, чтобы длины совпали)
export const safeEqual = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );

// ---------- Cookie ----------
export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    result[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return result;
}

export function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  maxAgeSeconds?: number,
) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  // Без Max-Age cookie "сессионная": браузер забывает её при закрытии
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
