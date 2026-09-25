// src/lib/password.ts — argon2id 密码哈希
import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTS = {
  algorithm: 2 as const, // argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, ARGON2_OPTS);
  } catch {
    return false;
  }
}
