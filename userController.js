import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import forge from "node-forge"; // นำเข้า node-forge
import { encryptPrivateKey } from "../utils/rsa.js";
// ฟังก์ชันสำหรับสร้างและตรวจสอบคู่กุญแจ RSA ว่าไม่ซ้ำกัน
const generateUniqueRSAKeyPair = async () => {
  let isUnique = false;
  let keypair;

  // ลูปจนกว่าจะได้คู่กุญแจที่ไม่ซ้ำ
  while (!isUnique) {
    keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

    // ตรวจสอบว่า public key นี้มีอยู่ในฐานข้อมูลหรือไม่
    const existingUser = await User.findOne({ rsaPublickey: publicKeyPem });

    if (!existingUser) {
      isUnique = true; // ถ้าไม่ซ้ำก็ถือว่าเป็น unique keypair
    }
  }

  // คืนค่า public และ private key ในรูปแบบ PEM
  return {
    publicKeyPem: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKeyPem: forge.pki.privateKeyToPem(keypair.privateKey),
  };
};

export const register = async (req, res) => {
  try {
    const { fullName, username, password, confirmPassword, gender } = req.body;

    // ตรวจสอบว่าข้อมูลทั้งหมดถูกส่งมา
    if (!fullName || !username || !password || !confirmPassword || !gender) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ตรวจสอบว่า password กับ confirmPassword ตรงกัน
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // ตรวจสอบว่ามีผู้ใช้ในระบบแล้วหรือยัง
    const user = await User.findOne({ username });
    if (user) {
      return res
        .status(400)
        .json({ message: "Username already exists, try a different one." });
    }

    // เข้ารหัส password
    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้าง profilePhoto ขึ้นอยู่กับ gender
    const maleProfilePhoto = `https://avatar.iran.liara.run/public/boy?username=${username}`;
    const femaleProfilePhoto = `https://avatar.iran.liara.run/public/girl?username=${username}`;

    // เรียกใช้ฟังก์ชัน generateUniqueRSAKeyPair เพื่อสร้างคู่กุญแจที่ไม่ซ้ำ
    const { publicKeyPem, privateKeyPem } = await generateUniqueRSAKeyPair();

    // เข้ารหัส private key
    const encryptedPrivateKey = encryptPrivateKey(privateKeyPem);

    // สร้างผู้ใช้ใหม่พร้อมกับกุญแจ RSA
    await User.create({
      fullName,
      username,
      password: hashedPassword,
      profilePhoto: gender === "male" ? maleProfilePhoto : femaleProfilePhoto,
      gender,
      rsaPublickey: publicKeyPem, // บันทึก public key ที่ตรวจสอบแล้วว่าไม่ซ้ำ
      // rsaPrivatekey: privateKeyPem, // บันทึก private key
      rsaPrivatekey: encryptedPrivateKey, // บันทึก private key ที่เข้ารหัส
    });

    return res.status(201).json({
      message: "Account created successfully.",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({
        message: "Incorrect username or password",
        success: false,
      });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        message: "Incorrect username or password",
        success: false,
      });
    }
    const tokenData = {
      userId: user._id,
    };

    const token = await jwt.sign(tokenData, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });

    return res
      .status(200)
      .cookie("token", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
      })
      .json({
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
      });
  } catch (error) {
    console.log(error);
  }
};
export const logout = (req, res) => {
  try {
    return res.status(200).cookie("token", "", { maxAge: 0 }).json({
      message: "logged out successfully.",
    });
  } catch (error) {
    console.log(error);
  }
};
export const getOtherUsers = async (req, res) => {
  try {
    const loggedInUserId = req.id;
    const otherUsers = await User.find({ _id: { $ne: loggedInUserId } }).select(
      "-password"
    );
    // console.log(otherUsers)
    return res.status(200).json(otherUsers);
  } catch (error) {
    console.log(error);
  }
};
