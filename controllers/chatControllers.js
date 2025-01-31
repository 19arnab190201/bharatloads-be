const Chat = require("../models/chat");
const Bid = require("../models/bid");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");
const NotificationService = require("../utils/notificationService");

// Get all chats for a user
exports.getUserChats = BigPromise(async (req, res, next) => {
  const userId = req.user._id;

  const chats = await Chat.find({ participants: userId })
    .populate({
      path: "participants",
      select: "name companyName mobile",
    })
    .populate({
      path: "bids",
      select: "status biddedAmount offeredAmount materialType source destination",
    })
    .sort({ lastMessage: -1 });

  res.status(200).json({
    success: true,
    data: chats,
  });
});

// Get chat messages
exports.getChatMessages = BigPromise(async (req, res, next) => {
  const { chatId } = req.params;
  const userId = req.user._id;

  const chat = await Chat.findOne({
    _id: chatId,
    participants: userId,
  })
    .populate({
      path: "participants",
      select: "name companyName mobile userType",
    })
    .populate({
      path: "messages.bidData",
      populate: [
        {
          path: "truckId",
          select: "truckNumber truckType truckCapacity vehicleBodyType truckTyre",
        },
        {
          path: "loadId",
          select: "materialType weight source destination",
        },
        {
          path: "bidBy",
          select: "name companyName mobile userType",
        },
        {
          path: "offeredTo",
          select: "name companyName mobile userType",
        },
      ],
    });

  if (!chat) {
    return next(new CustomError("Chat not found or unauthorized", 404));
  }

  res.status(200).json({
    success: true,
    data: chat,
  });
});

// Send a message
exports.sendMessage = BigPromise(async (req, res, next) => {
  const { chatId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!content) {
    return next(new CustomError("Message content is required", 400));
  }

  const chat = await Chat.findOne({
    _id: chatId,
    participants: userId,
  });

  if (!chat) {
    return next(new CustomError("Chat not found or unauthorized", 404));
  }

  await chat.addMessage(userId, content);

  // Find the other participant to send notification to
  const receiverId = chat.participants.find(
    (participantId) => participantId.toString() !== userId.toString()
  );

  // Send push notification
  await NotificationService.sendChatNotification(
    userId,
    receiverId,
    { content, messageType: "TEXT" },
    chatId
  );

  res.status(200).json({
    success: true,
    message: "Message sent successfully",
  });
});

// Create a new chat when bid is accepted
exports.createChatOnBidAccept = BigPromise(async (bidId) => {
  const bid = await Bid.findById(bidId);
  if (!bid) {
    throw new CustomError("Bid not found", 404);
  }

  // Create chat between bid creator and the person who was offered
  const chat = await Chat.findOrCreateChat(bid.bidBy, bid.offeredTo);

  // Add system message about bid acceptance
  await chat.addMessage(
    bid.offeredTo,
    "Bid has been accepted. You can now start chatting!",
    "BID_ACCEPTED",
    bid._id
  );

  // Send notification about bid acceptance
  await NotificationService.sendBidAcceptedNotification(bid);

  return chat;
});

// Get messages after a certain timestamp (for polling)
exports.getNewMessages = BigPromise(async (req, res, next) => {
  const { chatId } = req.params;
  const { lastMessageTime } = req.query;
  const userId = req.user._id;

  const chat = await Chat.findOne({
    _id: chatId,
    participants: userId,
  })
    .populate({
      path: "participants",
      select: "name companyName mobile userType",
    })
    .populate({
      path: "messages.bidData",
      populate: [
        {
          path: "truckId",
          select: "truckNumber truckType truckCapacity vehicleBodyType truckTyre",
        },
        {
          path: "loadId",
          select: "materialType weight source destination",
        },
        {
          path: "bidBy",
          select: "name companyName mobile userType",
        },
        {
          path: "offeredTo",
          select: "name companyName mobile userType",
        },
      ],
    });

  if (!chat) {
    return next(new CustomError("Chat not found or unauthorized", 404));
  }

  const newMessages = chat.messages.filter(
    (msg) => msg.timestamp > new Date(lastMessageTime)
  );

  res.status(200).json({
    success: true,
    data: newMessages,
  });
}); 