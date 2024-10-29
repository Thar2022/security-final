import { encryptAes, decryptAes,encryptImage, decryptImage } from './aes.js';
import dotenv from 'dotenv'; 
dotenv.config();

const secretKey = process.env.PRIVATEKEY_SECRET_KEY; // นำ secret key จาก .env

// ข้อมูลที่ต้องการเข้ารหัส
const plainText = "Hello, World!";

// เข้ารหัสข้อมูล
const encryptedData = encryptAes(plainText, secretKey);
console.log("Encrypted Data:", encryptedData);

// ถอดรหัสข้อมูล
const decryptedData = decryptAes(encryptedData, secretKey);
console.log("Decrypted Data:", decryptedData);


const imagePath = './picture/real/jerry_image.jpg'; // ใส่ path ของรูปภาพต้นฉบับ
const encryptedImagePath = './picture/encrypt/encryptedImage.enc'; // ไฟล์ที่จะเก็บข้อมูลที่เข้ารหัส

// const encryptedImagePath = './picture/real';  //'./encryptedImage.enc'; // ไฟล์ที่จะเก็บข้อมูลที่เข้ารหัส
const decryptedImagePath = './picture/decrypt/encryptedImage.jpg'; // ไฟล์ที่จะเก็บรูปภาพที่ถอดรหัส

// เข้ารหัสรูปภาพ
encryptImage(imagePath, encryptedImagePath,secretKey);
console.log("Image encrypted successfully!");

// ถอดรหัสรูปภาพ
decryptImage(encryptedImagePath, decryptedImagePath,secretKey);
console.log("Image decrypted successfully!");