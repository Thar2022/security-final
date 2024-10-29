import crypto from "crypto";
import fs from "fs";

// สร้าง secret key ขนาด 512 บิต (64 ไบต์)
const secretKey = crypto.randomBytes(32 );

// แปลงเป็น Base64
const secretKeyBase64 = secretKey.toString('base64');
console.log("Base64 Secret Key:", secretKeyBase64);

// บันทึกลงไฟล์ .env โดยไม่ลบข้อมูลเก่า
const envContent = `PRIVATEKEY_SECRET_KEY=${secretKeyBase64}\n`;

fs.writeFile('../.env', envContent, { flag: 'a' }, (err) => {
    if (err) {
        console.error('Error writing to .env file', err);
    } else {
        console.log('.env file has been updated with the secret key.');
    }
});
