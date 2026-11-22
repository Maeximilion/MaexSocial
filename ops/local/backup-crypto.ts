import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes, type KeyObject } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { Writable, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const maxArchiveBytes = 256 * 1024 * 1024;
const nonceBytes = 12;
const tagBytes = 16;
export const manifestAuthentication = 'pair.auth';

export interface ArchiveEncryption {
  nonce: string;
  tag: string;
  bytes: number;
}

export function validEncryption(value?: ArchiveEncryption): value is ArchiveEncryption {
  return !!value && typeof value.nonce === 'string' && /^[a-f0-9]{24}$/.test(value.nonce)
    && typeof value.tag === 'string' && /^[a-f0-9]{32}$/.test(value.tag)
    && Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= maxArchiveBytes;
}

export async function loadBackupKey(source?: string): Promise<KeyObject> {
  const path = process.env.MAEX_COLD_BACKUP_KEY_FILE;
  try {
    if (!path || !isAbsolute(path) || !(await lstat(path)).isFile()) throw new Error();
    const canonical = await realpath(path);
    for (const root of source ? [process.cwd(), source] : [process.cwd()]) {
      const rel = relative(await realpath(root), canonical);
      if (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) throw new Error();
    }
    const file = await open(canonical, 'r');
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size !== 32
          || (process.getuid && (info.uid !== process.getuid() || (info.mode & 0o077) !== 0))) throw new Error();
      const bytes = await file.readFile();
      try {
        if (bytes.length !== 32) throw new Error();
        return createSecretKey(bytes);
      } finally {
        bytes.fill(0);
      }
    } finally {
      await file.close();
    }
  } catch {
    throw new Error('Set MAEX_COLD_BACKUP_KEY_FILE to a private, external 32-byte synthetic backup key file.');
  }
}

function createEncryption(key: KeyObject, aad: Buffer) {
  const nonce = randomBytes(nonceBytes);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: tagBytes });
  cipher.setAAD(aad);
  return { nonce, cipher };
}

function createDecryption(key: KeyObject, aad: Buffer, nonce: Buffer, tag: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: tagBytes });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return decipher;
}

function manifestContext(pair: object): Buffer {
  return Buffer.from(JSON.stringify(['MaexSocial cold pair v3', pair]));
}

export async function authenticateManifest(path: string, pair: object, key: KeyObject): Promise<void> {
  try {
    const file = join(path, manifestAuthentication);
    const size = nonceBytes + tagBytes;
    const info = await lstat(file);
    if (!info.isFile() || info.size !== size) throw new Error();
    const seal = await readFile(file);
    if (seal.length !== size) throw new Error();
    createDecryption(key, manifestContext(pair), seal.subarray(0, nonceBytes), seal.subarray(nonceBytes)).final();
  } catch {
    throw new Error('Backup manifest authentication failed.');
  }
}

export async function sealManifest(path: string, pair: object, key: KeyObject): Promise<void> {
  const { cipher, nonce } = createEncryption(key, manifestContext(pair));
  cipher.final();
  await writeFile(join(path, manifestAuthentication), Buffer.concat([nonce, cipher.getAuthTag()]),
    { mode: 0o600, flag: 'wx' });
}

function archiveContext(fixtureId: string, role: string): Buffer {
  return Buffer.from(JSON.stringify(['MaexSocial cold archive v3', fixtureId, role]));
}

export async function encryptArchive(input: Readable, path: string, key: KeyObject,
  fixtureId: string, role: string): Promise<ArchiveEncryption> {
  const { cipher, nonce } = createEncryption(key, archiveContext(fixtureId, role));
  let bytes = 0;
  await pipeline(input, async function* (chunks) {
    for await (const chunk of chunks) {
      bytes += chunk.length;
      if (bytes > maxArchiveBytes) throw new Error('Synthetic backup archive exceeds the fixture size limit.');
      yield chunk;
    }
    if (!bytes) throw new Error('Synthetic backup archive is empty.');
  }, cipher, createWriteStream(path, { mode: 0o600, flags: 'wx' }));
  return { bytes, nonce: nonce.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

export async function decryptArchive(path: string, encryption: ArchiveEncryption, expectedSha256: string,
  key: KeyObject, fixtureId: string, role: string, output?: Writable): Promise<void> {
  const decipher = createDecryption(key, archiveContext(fixtureId, role),
    Buffer.from(encryption.nonce, 'hex'), Buffer.from(encryption.tag, 'hex'));
  const ciphertextHash = createHash('sha256');
  let bytes = 0;
  const checkCiphertext = async function* (chunks: AsyncIterable<Buffer>) {
    for await (const chunk of chunks) {
      bytes += chunk.length;
      if (bytes > encryption.bytes) throw new Error();
      ciphertextHash.update(chunk);
      yield chunk;
    }
    if (bytes !== encryption.bytes || ciphertextHash.digest('hex') !== expectedSha256) throw new Error();
  };
  const finishImport = async function* (chunks: AsyncIterable<Buffer>) {
    const plaintextHash = createHash('sha256');
    for await (const chunk of chunks) {
      plaintextHash.update(chunk);
      yield chunk;
    }
    // The importer checks exact length and this completion digest before opening the tar.
    yield Buffer.from(plaintextHash.digest('hex'), 'ascii');
  };
  try {
    if (output) {
      await pipeline(createReadStream(path), checkCiphertext, decipher, finishImport, output);
    } else {
      await pipeline(createReadStream(path), checkCiphertext, decipher, new Writable({
        write(_chunk, _encoding, callback) { callback(); },
      }));
    }
  } catch {
    throw new Error('Backup archive authentication or SHA-256 check failed.');
  }
}
