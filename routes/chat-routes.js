const express = require("express");
const router = express.Router();
const {
  getUserChats,
  getChatMessages,
  sendMessage,
  getNewMessages,
} = require("../controllers/chatControllers");
const { isLoggedIn } = require("../middlewares/user");

// Get all chats for the logged-in user
router.route("/chats").get(isLoggedIn, getUserChats);

// Get messages for a specific chat
router.route("/chats/:chatId").get(isLoggedIn, getChatMessages);

// Send a message in a chat
router.route("/chats/:chatId/messages").post(isLoggedIn, sendMessage);

// Get new messages after a timestamp (for polling)
router.route("/chats/:chatId/poll").get(isLoggedIn, getNewMessages);

module.exports = router; 