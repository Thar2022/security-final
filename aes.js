import crypto from "crypto";
import fs from 'fs'

// ฟังก์ชันสำหรับเข้ารหัสข้อมูล
export function encryptAes(plainText, secretKey) {
  const iv = crypto.randomBytes(16); // สร้าง IV ขนาด 16 ไบต์
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(secretKey, "base64"), iv);
  
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  // คืนค่า IV และข้อมูลที่เข้ารหัส
  return `${iv.toString("base64")}:${encrypted}`;
}

// ฟังก์ชันสำหรับถอดรหัสข้อมูล
export function decryptAes(encryptedData, secretKey) {
  const [ivBase64, encryptedTextBase64] = encryptedData.split(":");
  
  const iv = Buffer.from(ivBase64, "base64");
  const encryptedText = Buffer.from(encryptedTextBase64, "base64");
  
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(secretKey, "base64"), iv);
  
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}



 // ฟังก์ชันสำหรับเข้ารหัสรูปภาพ
// export function encryptImage(imagePath, outputPath,secretKey) {
//   const imageBuffer = fs.readFileSync(imagePath); // อ่านรูปภาพเป็นบัฟเฟอร์
//   const encryptedData = encryptAes(imageBuffer.toString('base64'), secretKey); // เข้ารหัสเป็น base64
//   fs.writeFileSync(outputPath, encryptedData); // บันทึกข้อมูลที่เข้ารหัส
// }

// ฟังก์ชันสำหรับเข้ารหัสรูปภาพ
export function encryptImage(imagePath, outputPath,secretKey) {
  try {
    const imageBuffer = fs.readFileSync(imagePath); // อ่านรูปภาพเป็นบัฟเฟอร์
    const encryptedData = encryptAes(imageBuffer.toString('base64'), secretKey); // เข้ารหัสเป็น base64
    fs.writeFileSync(outputPath, encryptedData); // บันทึกข้อมูลที่เข้ารหัส
  } catch (error) {
    console.error("Error encrypting image:", error);
  }
}

// ฟังก์ชันสำหรับถอดรหัสรูปภาพ
export function decryptImage(encryptedImagePath, outputPath,secretKey) {
  const encryptedData = fs.readFileSync(encryptedImagePath, 'utf-8'); // อ่านข้อมูลที่เข้ารหัส
  const decryptedData = decryptAes(encryptedData, secretKey); // ถอดรหัส
  const imageBuffer = Buffer.from(decryptedData, 'base64'); // แปลงกลับเป็นบัฟเฟอร์
  fs.writeFileSync(outputPath, imageBuffer); // บันทึกรูปภาพที่ถอดรหัส
}
