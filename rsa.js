// rsa.js
import forge from "node-forge"; // ใช้ import แทน require
import crypto from "crypto";
// ฟังก์ชันเข้ารหัส
export function encryptRsaByPem(plainText, publicKeyPem) {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  // const encrypted = publicKey.encrypt(forge.util.createBuffer(plainText), 'RSA-OAEP');
  const buffer = forge.util.createBuffer(plainText, "utf8"); // ระบุประเภทเป็น 'utf8'
  const encrypted = publicKey.encrypt(buffer.getBytes(), "RSA-OAEP");
  return forge.util.encode64(encrypted);
}

// ฟังก์ชันถอดรหัส
export function decryptRsaByPem(cipherText, privateKeyPem) {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const decoded = forge.util.decode64(cipherText);
  const decrypted = privateKey.decrypt(decoded, "RSA-OAEP");
  //   return decrypted;
  return Buffer.from(decrypted, "binary").toString("utf8");
}

// ฟังก์ชันสำหรับเข้ารหัส private key
export function encryptPrivateKey(privateKey) {
  const secretKey = process.env.PRIVATEKEY_SECRET_KEY; // นำ secret key จาก .env
  const iv = crypto.randomBytes(16); // สร้าง IV ขนาด 16 ไบต์

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(secretKey, "base64"),
    iv
  );
  let encrypted = cipher.update(privateKey, "utf8", "base64");
  encrypted += cipher.final("base64");

  // คืนค่า IV และข้อมูลที่เข้ารหัส
  return `${iv.toString("base64")}:${encrypted}`;
}

export function decryptPrivateKey(encryptedData) {
  const secretKey = process.env.PRIVATEKEY_SECRET_KEY;
  const [ivBase64, encryptedTextBase64] = encryptedData.split(":");

  const iv = Buffer.from(ivBase64, "base64");
  const encryptedText = Buffer.from(encryptedTextBase64, "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(secretKey, "base64"),
    iv
  );
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function generateKey() {
  const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair({
    bits: 2048,
  });

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(publicKey),
  };
}

// สร้างคู่กุญแจ
const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair({ bits: 2048 }); // สร้าง public key และ private key
export const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
export const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
