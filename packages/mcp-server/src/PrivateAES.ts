import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';

const algorithm = 'aes-256-gcm';

/**
 * Encrypts an EVM private key using bcrypt and user password.
 * @param privateKey - The EVM private key to encrypt
 * @param password - User-provided password
 * @returns Encrypted string (Base64 encoded)
 */
export async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const bcryptSalt = hashedPassword.substring(0, 29);
  const key = crypto.createHash('sha256').update(hashedPassword).digest();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([Buffer.from(bcryptSalt), iv, authTag, Buffer.from(encrypted, 'base64')]);

  return result.toString('base64');
}

/**
 * Decrypts an EVM private key using bcrypt and user password.
 * @param encryptedData - Encrypted private key data (Base64 encoded)
 * @param password - User-provided password
 * @returns Decrypted private key or null if password is incorrect
 */
export async function decryptPrivateKey(encryptedData: string, password: string): Promise<string | null> {
  try {
    const data = Buffer.from(encryptedData, 'base64');
    const bcryptSalt = data.subarray(0, 29).toString();
    const iv = data.subarray(29, 41);
    const authTag = data.subarray(41, 57);
    const encrypted = data.subarray(57).toString('base64');

    const hashedPassword = await bcrypt.hash(password, bcryptSalt);
    const key = crypto.createHash('sha256').update(hashedPassword).digest();

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}
