const Chat = require("../models/chat");
const Message = require("../models/message");
const User = require("../models/user");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");

exports.getUserChats = BigPromise(async (req, res) => {
  const chats = await Chat.find({
    participants: req.user._id
  })
  .populate("participants", "name mobile userType")
  .populate("lastMessage")
  .sort("-updatedAt");

  res.status(200).json({
    success: true,
    chats
  });
});

exports.createOrGetChat = BigPromise(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new CustomError("UserId is required", 400);
  }

  // Check if chat already exists
  let chat = await Chat.findOne({
    participants: {
      $all: [req.user._id, userId]
    }
  }).populate("participants", "name mobile userType");

  if (chat) {
    return res.status(200).json({
      success: true,
      chat
    });
  }

  // Create new chat
  chat = await Chat.create({
    participants: [req.user._id, userId]
  });

  chat = await chat.populate("participants", "name mobile userType");

  res.status(201).json({
    success: true,
    chat
  });
});

exports.getChatMessages = BigPromise(async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const messages = await Message.find({ chat: chatId })
    .populate("sender", "name mobile userType")
    .sort("-createdAt")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  res.status(200).json({
    success: true,
    messages
  });
});

exports.sendMessage = BigPromise(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new CustomError("Message content is required", 400);
  }

  // Check if chat exists and user is a participant
  const chat = await Chat.findOne({
    _id: chatId,
    participants: req.user._id
  });

  if (!chat) {
    throw new CustomError("Chat not found or you're not a participant", 404);
  }

  // Create message
  const message = await Message.create({
    chat: chatId,
    sender: req.user._id,
    content,
    readBy: [req.user._id]
  });

  // Update last message in chat
  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: message._id
  });

  // Populate sender details
  await message.populate('sender', 'name mobile userType');

  res.status(201).json({
    success: true,
    message
  });
}); 