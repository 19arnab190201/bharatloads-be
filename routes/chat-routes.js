const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middlewares/user");
const {
  getUserChats,
  createOrGetChat,
  getChatMessages,
  sendMessage
} = require("../controllers/chatController");

router.get("/chats", isLoggedIn, getUserChats);
router.post("/chat", isLoggedIn, createOrGetChat);
router.get("/chat/:chatId/messages", isLoggedIn, getChatMessages);
router.post("/chat/:chatId/message", isLoggedIn, sendMessage);

module.exports = router; 