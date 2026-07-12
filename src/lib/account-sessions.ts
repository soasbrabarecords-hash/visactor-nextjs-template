import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { cookies } from "next/headers";
import "server-only";

const ACCOUNT_COOKIE_PREFIX = "sab-account-";
const ACCOUNT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const ENCRYPTION_VERSION = "v1";

export type StoredAccountSession = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  refreshToken: string;
  updatedAt: string;
};

export type ConnectedAccount = Omit<StoredAccountSession, "refreshToken">;

function getEncryptionKey() {
  const secret =
    process.env.ACCOUNT_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Configure ACCOUNT_SESSION_SECRET para habilitar a troca de contas.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

function encryptSession(session: StoredAccountSession) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    initializationVector,
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSession(value: string): StoredAccountSession | null {
  try {
    const [version, initializationVector, authenticationTag, encrypted] =
      value.split(".");

    if (
      version !== ENCRYPTION_VERSION ||
      !initializationVector ||
      !authenticationTag ||
      !encrypted
    ) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(initializationVector, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const session = JSON.parse(decrypted) as Partial<StoredAccountSession>;

    if (
      typeof session.userId !== "string" ||
      typeof session.refreshToken !== "string" ||
      typeof session.updatedAt !== "string"
    ) {
      return null;
    }

    return {
      userId: session.userId,
      email: typeof session.email === "string" ? session.email : null,
      displayName:
        typeof session.displayName === "string" ? session.displayName : null,
      avatarUrl:
        typeof session.avatarUrl === "string" ? session.avatarUrl : null,
      refreshToken: session.refreshToken,
      updatedAt: session.updatedAt,
    };
  } catch {
    return null;
  }
}

function cookieName(userId: string) {
  return `${ACCOUNT_COOKIE_PREFIX}${userId}`;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCOUNT_COOKIE_MAX_AGE,
  };
}

export async function storeAccountSession(session: StoredAccountSession) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(session.userId), encryptSession(session), {
    ...cookieOptions(),
  });
}

export async function readStoredAccount(userId: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName(userId))?.value;
  return value ? decryptSession(value) : null;
}

export async function readStoredAccounts() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .filter(({ name }) => name.startsWith(ACCOUNT_COOKIE_PREFIX))
    .map(({ value }) => decryptSession(value))
    .filter((session): session is StoredAccountSession => Boolean(session))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export async function removeStoredAccount(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(userId), "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export async function clearStoredAccounts() {
  const cookieStore = await cookies();
  cookieStore
    .getAll()
    .filter(({ name }) => name.startsWith(ACCOUNT_COOKIE_PREFIX))
    .forEach(({ name }) => {
      cookieStore.set(name, "", {
        ...cookieOptions(),
        maxAge: 0,
      });
    });
}

export function publicAccount(session: StoredAccountSession): ConnectedAccount {
  return {
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
    updatedAt: session.updatedAt,
  };
}
