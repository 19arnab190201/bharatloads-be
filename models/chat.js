const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  messageType: {
    type: String,
    enum: ["TEXT", "SYSTEM", "BID_ACCEPTED"],
    default: "TEXT"
  },
  bidData: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }],
  bids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
  }],
  messages: [messageSchema],
  lastMessage: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

// Create a compound index for participants to ensure uniqueness
// This ensures only one chat exists between any two users
chatSchema.index({ participants: 1 }, { unique: true });

// Method to add a new message
chatSchema.methods.addMessage = async function(senderId, content, messageType = "TEXT", bidData = null) {
  const messagePayload = {
    sender: senderId,
    content,
    messageType,
  };

  if (bidData && messageType === "BID_ACCEPTED") {
    messagePayload.bidData = bidData;
    // Add bid to bids array if not already present
    if (!this.bids.includes(bidData)) {
      this.bids.push(bidData);
    }
  }

  this.messages.push(messagePayload);
  this.lastMessage = Date.now();
  return this.save();
};

// Static method to find or create a chat between two users
chatSchema.statics.findOrCreateChat = async function(user1Id, user2Id) {
  // Sort user IDs to ensure consistent ordering
  const participants = [user1Id, user2Id].sort();
  
  let chat = await this.findOne({
    participants: { $all: participants }
  });

  if (!chat) {
    chat = await this.create({
      participants,
      bids: [],
    });
  }

  return chat;
};

module.exports = mongoose.model("Chat", chatSchema); 