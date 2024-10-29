import { Conversation } from "../models/conversationModel.js";
import { Message } from "../models/messageModel.js";
import { User } from "../models/userModel.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import {
  encryptRsaByPem,
  decryptRsaByPem,
  encryptPrivateKey,
  decryptPrivateKey,
} from "../utils/rsa.js";
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const receiverId = req.params.id;
    const { message } = req.body;

    // ค้นหา conversation ระหว่างผู้ส่งและผู้รับ และต้องไม่ใช่การสนทนาแบบกลุ่ม
    let gotConversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
      isGroupConversation: false, // ระบุชัดเจนว่าไม่ใช่กลุ่ม
    });

    // ถ้าไม่พบการสนทนา ให้สร้างการสนทนาใหม่
    if (!gotConversation) {
      gotConversation = await Conversation.create({
        participants: [senderId, receiverId],
        isGroupConversation: false, // ตั้งค่าให้เป็นการสนทนาแบบส่วนตัว
      });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      message,
    });
    if (newMessage) {
      gotConversation.messages.push(newMessage._id);
    }
    // console.log(gotConversation)
    // console.log("sendMessage")
    await Promise.all([gotConversation.save(), newMessage.save()]);

    // SOCKET IO
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    return res.status(201).json({
      newMessage,
    });
  } catch (error) {
    console.log(error);
  }
};

export const sendGroupMessage = async (req, res) => {
  console.log("messageController.js sendGroupMessage");
  try {
    const senderId = req.id; // ผู้ส่งที่ได้จาก middleware isAuthenticated
    const { message, conversationId } = req.body; // ข้อความที่ต้องการส่ง cละ conversationId
    // console.log("senderId " ,senderId  )
    console.log("{ message, conversationId }", message, conversationId);
    // ค้นหา conversation ที่เป็นกลุ่มตาม conversationId
    const groupConversation = await Conversation.findOne({
      _id: conversationId,
      isGroupConversation: true, // ต้องเป็นแชทกลุ่ม
      participants: senderId, // ผู้ส่งต้องเป็นหนึ่งใน participants
    });

    // ถ้าไม่พบ conversation หรือผู้ส่งไม่อยู่ใน participants ให้ส่ง error กลับ
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    // สร้างข้อความใหม่
    const newMessage = await Message.create({
      senderId,
      message,
    });

    // บันทึกข้อความใหม่ลงในกลุ่มสนทนา
    groupConversation.messages.push(newMessage._id);
    await Promise.all([groupConversation.save(), newMessage.save()]);

    // ดึงข้อมูล senderId ที่ต้องการ (เช่น profilePhoto, fullName) จาก User model
    const populatedMessage = await Message.findById(newMessage._id).populate({
      path: "senderId",
      select: "_id profilePhoto fullName", // เลือกเฉพาะฟิลด์ที่ต้องการ
    });

    // ส่งข้อความไปยังผู้เข้าร่วมทุกคนในกลุ่มผ่าน Socket.IO
    // groupConversation.participants.forEach((participantId) => {
    //   const receiverSocketId = getReceiverSocketId(participantId);
    //   if (receiverSocketId) {
    //     io.to(receiverSocketId).emit("newGroupMessage", newMessage);
    //   }
    // });

    // SOCKET IO - ส่งข้อความไปยังสมาชิกทุกคนในกลุ่ม
    console.log(" // SOCKET IO - ส่งข้อความไปยังสมาชิกทุกคนในกลุ่ม");
    groupConversation.participants.forEach((participantId) => {
      if (participantId.toString() !== senderId) {
        const participantSocketId = getReceiverSocketId(participantId);

        console.log(" // if (participantId !== senderId)");
        if (participantSocketId) {
          console.log(" //if (participantSocketId))", participantSocketId);
          io.to(participantSocketId).emit("newGroupMessage", populatedMessage);
        }
      }
    });

    return res.status(201).json({
      message: "Message sent successfully",
      newMessage,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendGroupEncryptMessage = async (req, res) => {
  console.log("messageController.js sendGroupEncryptMessage");
  try {
    const senderId = req.id; // ผู้ส่งที่ได้จาก middleware isAuthenticated
    const { conversationId, recipientId, message } = req.body; // ข้อความที่ต้องการส่ง รับ conversationId และ recipientId
    console.log(
      " { conversationId, recipientId, message } ",
      conversationId,
      recipientId,
      message
    );

    // ค้นหา conversation ตาม conversationId และตรวจสอบว่า senderId เป็น creator
    const groupConversation = await Conversation.findOne({
      _id: conversationId,
      isGroupConversation: true,
      creatorId: senderId, // ตรวจสอบว่าผู้ส่งเป็น creator ของห้องนี้
    });
    console.log("1");
    // ถ้าไม่พบกลุ่มหรือผู้ส่งไม่ใช่ creator ให้ส่ง error กลับ
    if (!groupConversation) {
      return res.status(403).json({
        message: "Forbidden: You are not the creator of this group",
      });
    }

    console.log("2");
    // ตรวจสอบว่า recipientId เป็นหนึ่งใน participants ของกลุ่มหรือไม่
    if (senderId === recipientId) {
      return res
        .status(400)
        .json({ message: "You can not send message to yourself" });
    }
    if (!groupConversation.participants.includes(recipientId)) {
      return res
        .status(400)
        .json({ message: "Recipient is not a participant in the group" });
    }

    console.log("3");
    // ค้นหา public key ของ recipient จาก User model
    const recipient = await User.findById(recipientId);
    const creator = await User.findById(senderId);
    if (!recipient || !recipient?.rsaPublickey) {
      return res
        .status(404)
        .json({ message: "Recipient's public key not found" });
    }

    console.log("4");
    // เข้ารหัสข้อความด้วย public key ของ recipient (ใช้ node-forge)
    const encryptedMessage = encryptRsaByPem(message, recipient.rsaPublickey);
    const encryptedMessageForCreator = encryptRsaByPem(
      message,
      creator.rsaPublickey
    );
    console.log("encryptedMessage", encryptedMessage);
    // สร้างข้อความใหม่ที่เข้ารหัสแล้ว
    const newMessage = await Message.create({
      senderId,
      receiverId: recipientId,
      message: encryptedMessage, // บันทึกข้อความที่เข้ารหัสแล้ว
      messageForCreator: encryptedMessageForCreator,
      isEncrypted: true,
    });

    console.log("5");
    // เพิ่มข้อความใหม่ลงใน group conversation
    groupConversation.messages.push(newMessage._id);
    await Promise.all([groupConversation.save(), newMessage.save()]);

    // ดึงข้อมูล senderId ที่ต้องการ (เช่น profilePhoto, fullName) จาก User model
    const populatedMessage = await Message.findById(newMessage._id).populate({
      path: "senderId",
      select: "_id profilePhoto fullName", // เลือกเฉพาะฟิลด์ที่ต้องการ
    });

    // console.log("populatedMessage", {
    //   ...populatedMessage._doc,
    //   decryptedMessage: "Test",
    // });

    // ส่งข้อความไปยังผู้เข้าร่วมทุกคนในกลุ่มผ่าน Socket.IO
    // groupConversation.participants.forEach((participantId) => {
    //   const receiverSocketId = getReceiverSocketId(participantId);
    //   if (receiverSocketId) {
    //     io.to(receiverSocketId).emit("newGroupMessage", newMessage);
    //   }
    // });

    // SOCKET IO - ส่งข้อความไปยังสมาชิกทุกคนในกลุ่ม
    console.log(" // SOCKET IO - ส่งข้อความไปยังสมาชิกทุกคนในกลุ่ม");

    groupConversation.participants.forEach((participantId) => {
      if (participantId.toString() !== senderId) {
        const participantSocketId = getReceiverSocketId(participantId);

        console.log(" // if (participantId !== senderId)");
        if (participantSocketId) {
          console.log(" //if (participantSocketId))", participantSocketId);
          console.log(" participantId !== senderId", participantId, senderId);
          io.to(participantSocketId).emit("newGroupMessage", {
            ...populatedMessage._doc,
            decryptedMessage:
              participantId.toString() === recipientId ? message : "",
            isEncrypted: true,
          });
          //
        }
      }
    });

    console.log("6");
    return res.status(201).json({
      message: "Encrypted message sent successfully",
      newMessage: {
        ...populatedMessage._doc,
        decryptedMessage: message,
        isEncrypted: true,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getGroupMessage = async (req, res) => {
  console.log("messageController.js getGroupMessage");
  try {
    const { conversationId } = req.params;
    const userId = req.id; // ดึง id ของผู้ใช้ที่ authenticated เข้ามา

    // ค้นหา conversation ตาม conversationId และตรวจสอบว่าผู้ใช้เป็นสมาชิกในกลุ่ม
    let groupConversation = await Conversation.findOne({
      _id: conversationId,
      isGroupConversation: true,
      participants: userId, // ตรวจสอบว่าผู้ใช้เป็นหนึ่งในผู้เข้าร่วมกลุ่ม
    }).populate({
      path: "messages",
      populate: [
        {
          path: "senderId", // เพิ่มข้อมูลผู้ส่ง
          select: "fullName profilePhoto", // เลือกฟิลด์ที่ต้องการจาก sender (ผู้ส่ง)
        },
        {
          path: "receiverId", // หากต้องการข้อมูล receiver ในบริบทนี้
          select: "fullName profilePhoto", // เลือกฟิลด์ที่ต้องการจาก receiver
        },
      ],
    });
    // แปลงข้อมูลเพื่อให้ได้โครงสร้างตามที่คุณต้องการ
    groupConversation = groupConversation.messages.map((message) => {
      if (message?.receiverId) {
        return {
          ...message._doc, // นำข้อมูลดั้งเดิมทั้งหมดของ message มาใช้
          receiverId: message.receiverId._id, // แยก receiverId ออกมา
          receiver: {
            fullName: message.receiverId.fullName,
            profilePhoto: message.receiverId.profilePhoto,
          }, // เพิ่มข้อมูล receiver แยกต่างหาก
        };
      }
      return message;
    });
    // console.log(groupConversation);

    // console.log(groupConversation)
    // console.log("22")
    // ถ้าไม่พบการสนทนาหรือผู้ใช้ไม่ได้อยู่ในกลุ่ม ให้ส่ง error กลับ
    if (!groupConversation) {
      return res
        .status(403)
        .json({ message: "Unauthorized: You are not part of this group" });
    }
    // console.log("22")
    // ค้นหา private key ของผู้ใช้จาก User model
    const user = await User.findById(userId);
    // ถอดรหัส private key
    const privateKeyPem = decryptPrivateKey(user.rsaPrivatekey);

    if (!user || !user.rsaPrivatekey) {
      return res.status(404).json({ message: "Your private key not found" });
    }

    // ถอดรหัสเฉพาะข้อความที่ถูกเข้ารหัสและผู้ใช้เป็นผู้รับข้อความ
    const messagesWithDecryption = groupConversation.map((message) => {
      let decryptedMessage = null;

      // ตรวจสอบว่าผู้ใช้เป็นผู้รับข้อความและข้อความนั้นเป็นข้อความที่ถูกเข้ารหัส
      // console.log("message.receiverId === userId && message.isEncrypted",message.senderId._id?.toString() ,userId ,message.receiverId?.toString() ===userId , message.isEncrypted)
      if (message.receiverId?.toString() === userId && message.isEncrypted) {
        try {
          // ถอดรหัสข้อความด้วย private key ของผู้ใช้
          // console.log("message.message", message.message);
          // console.log("resPrivateKey", user.rsaPrivatekey);
          decryptedMessage = decryptRsaByPem(message.message, privateKeyPem);

          // console.log("decryptedMessage", decryptedMessage);
        } catch (error) {
          console.error("Decryption failed:", error);
        }
      } else if (
        message.senderId?._id.toString() === userId &&
        message.isEncrypted
      ) {
        try {
          // console.log("message.senderId", message.messageForCreator);
          decryptedMessage = decryptRsaByPem(
            message.messageForCreator,
            privateKeyPem
          );
        } catch (error) {
          console.error("Decryption failed:", error);
        }
      }

      // คืนค่าข้อมูลข้อความทั้งที่เข้ารหัสและถอดรหัสแล้ว (ถ้ามี)
      // return {
      //   _id: message._id,
      //   senderId: message.senderId,
      //   receiverId: message.receiverId,
      //   message: message.message,
      //   decryptedMessage: decryptedMessage || "", // ถ้าไม่สามารถถอดรหัสได้
      //   isEncrypted: message.isEncrypted,
      //   createdAt: message.createdAt,
      //   receiver:message.receiver || null,
      // };

      // สร้างอ็อบเจ็กต์ผลลัพธ์ที่คืนค่า
      const result = {
        _id: message._id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        message: message.message,
        decryptedMessage: decryptedMessage || "", // ถ้าไม่สามารถถอดรหัสได้
        isEncrypted: message.isEncrypted,
        createdAt: message.createdAt,
      };

      // เพิ่มฟิลด์ receiver ถ้ามีค่า
      if (message.receiver) {
        result.receiver = message.receiver;
      }

      return result; // คืนค่า result
    });

    return res.status(200).json(messagesWithDecryption);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMessage = async (req, res) => {
  try {
    // console.log("getMessage")
    const receiverId = req.params.id;
    const senderId = req.id;
    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
      isGroupConversation: false, // ต้องไม่ใช่กลุ่ม
    }).populate("messages");
    // console.log(conversation)
    // console.log("getMessage")
    return res.status(200).json(conversation?.messages);
  } catch (error) {
    console.log(error);
  }
};
