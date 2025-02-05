const admin = require("firebase-admin");
const User = require("../models/user");
const axios = require("axios");

let firebaseApp;

// Initialize Firebase Admin with your service account
if (!admin.apps.length) {
  try {
    console.log("Initializing Firebase Admin with:", {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    });

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
} else {
  firebaseApp = admin.app();
}

class NotificationService {
  static async sendExpoNotification(expoPushToken, notification, data) {
    try {
      const message = {
        to: expoPushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: data,
        priority: "high",
        channelId:
          data.messageType === "BID_ACCEPTED" ? "bid-updates" : "chat-messages",
      };

      const response = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        message,
        {
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error sending Expo notification:", error);
      throw error;
    }
  }

  static isExpoToken(token) {
    return (
      token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken[")
    );
  }

  static isFCMToken(token) {
    // FCM tokens are typically longer and contain only letters, numbers, and dashes
    return /^[a-zA-Z0-9:_-]+$/.test(token) && token.length > 100;
  }

  static async sendNotification(token, notification, data) {
    try {
      if (this.isExpoToken(token)) {
        return await this.sendExpoNotification(token, notification, data);
      } else if (this.isFCMToken(token)) {
        return await admin.messaging().send({
          token,
          notification,
          data,
          android: {
            priority: "high",
            notification: {
              channelId:
                data.messageType === "BID_ACCEPTED"
                  ? "bid-updates"
                  : "chat-messages",
              sound: "default",
              priority: "high",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
                contentAvailable: true,
              },
            },
          },
        });
      } else {
        throw new Error(`Invalid token format: ${token}`);
      }
    } catch (error) {
      console.error(`Error sending notification to token ${token}:`, error);
      throw error;
    }
  }

  // Update the token validation in your existing methods
  static isTokenInvalid(error) {
    return (
      error.code === "messaging/invalid-registration-token" ||
      error.message?.includes("ExpoPushToken") ||
      error.message?.includes("Invalid push token")
    );
  }

  static async sendChatNotification(
    senderId,
    receiverId,
    messageContent,
    chatId
  ) {
    try {
      // Get sender details
      const sender = await User.findById(senderId);

      // Get receiver's device tokens
      const receiver = await User.findById(receiverId);
      if (
        !receiver ||
        !receiver.deviceTokens ||
        receiver.deviceTokens.length === 0
      ) {
        console.log("No device tokens found for receiver:", receiverId);
        return;
      }

      // Only send notification to the receiver's tokens
      const tokens = receiver.deviceTokens.map((device) => device.token);
      console.log("Sending notification to tokens:", tokens);

      // Prepare notification payload
      const notification = {
        title: `New message from ${sender.name}`,
        body:
          messageContent.messageType === "BID_ACCEPTED"
            ? "🤝 New bid accepted!"
            : messageContent.content.substring(0, 100), // Truncate long messages
      };

      const data = {
        chatId: chatId.toString(),
        messageType: messageContent.messageType,
        senderId: senderId.toString(),
        senderName: sender.name,
        timestamp: new Date().toISOString(),
        click_action: "CHAT_NOTIFICATION",
      };

      // Convert all data values to strings as required
      Object.keys(data).forEach((key) => {
        data[key] = String(data[key]);
      });

      // Send notifications only to receiver's tokens
      const results = await Promise.all(
        tokens.map(async (token) => {
          try {
            return await this.sendNotification(token, notification, data);
          } catch (error) {
            console.error(
              `Error sending notification to token ${token}:`,
              error
            );
            return error;
          }
        })
      );

      console.log("Notification send results:", results);

      // Clean up invalid tokens based on errors
      const invalidTokens = tokens.filter((token, index) => {
        const error = results[index] instanceof Error ? results[index] : null;
        return error && this.isTokenInvalid(error);
      });

      if (invalidTokens.length > 0) {
        console.log("Removing invalid tokens:", invalidTokens);
        receiver.deviceTokens = receiver.deviceTokens.filter(
          (device) => !invalidTokens.includes(device.token)
        );
        await receiver.save();
      }

      return results;
    } catch (error) {
      console.error("Error sending notification:", error);
      console.error("Error details:", error.stack);
    }
  }

  static async sendBidAcceptedNotification(bid) {
    try {
      const sender = await User.findById(bid.offeredTo);
      const receiver = await User.findById(bid.bidBy);

      if (
        !receiver ||
        !receiver.deviceTokens ||
        receiver.deviceTokens.length === 0
      ) {
        console.log("No device tokens found for bid receiver:", bid.bidBy);
        return;
      }

      const tokens = receiver.deviceTokens.map((device) => device.token);
      console.log("Sending bid accepted notification to tokens:", tokens);

      const notification = {
        title: "🎉 Congratulations! Bid Accepted",
        body: `${sender.name} has accepted your bid of ₹${
          bid.biddedAmount.total
        } for the ${bid.bidType === "LOAD_BID" ? "load" : "truck"} from ${
          bid.source.placeName
        } to ${bid.destination.placeName}`,
      };

      const data = {
        bidId: bid._id.toString(),
        type: "BID_ACCEPTED",
        click_action: "BID_NOTIFICATION",
        loadId: bid.loadId.toString(),
        senderId: bid.offeredTo.toString(),
        senderName: sender.name,
        materialType: bid.materialType,
        source: bid.source.placeName,
        destination: bid.destination.placeName,
        amount: bid.biddedAmount.total.toString(),
        timestamp: new Date().toISOString(),
      };

      // Convert all data values to strings as required
      Object.keys(data).forEach((key) => {
        data[key] = String(data[key]);
      });

      // Send notifications to all tokens
      const results = await Promise.all(
        tokens.map(async (token) => {
          try {
            return await this.sendNotification(token, notification, data);
          } catch (error) {
            console.error(
              `Error sending notification to token ${token}:`,
              error
            );
            return error;
          }
        })
      );

      console.log("Bid accepted notification send results:", results);

      // Clean up invalid tokens
      const invalidTokens = tokens.filter((token, index) => {
        const error = results[index] instanceof Error ? results[index] : null;
        return error && this.isTokenInvalid(error);
      });

      if (invalidTokens.length > 0) {
        console.log("Removing invalid tokens:", invalidTokens);
        receiver.deviceTokens = receiver.deviceTokens.filter(
          (device) => !invalidTokens.includes(device.token)
        );
        await receiver.save();
      }
    } catch (error) {
      console.error("Error sending bid accepted notification:", error);
      console.error("Error details:", error.stack);
    }
  }

  static async sendBidPlacedNotification(bid, loadPost) {
    try {
      // Get receiver's device tokens (load owner)
      const receiver = await User.findById(bid.offeredTo);
      if (
        !receiver ||
        !receiver.deviceTokens ||
        receiver.deviceTokens.length === 0
      ) {
        console.log("No device tokens found for receiver:", bid.offeredTo);
        return;
      }

      const sender = await User.findById(bid.bidBy);
      const tokens = receiver.deviceTokens.map((device) => device.token);
      console.log("Sending bid placed notification to tokens:", tokens);

      const notification = {
        title: "New Bid Placed! 📦",
        body: `${sender.name} has placed a bid of ₹${
          bid.biddedAmount.total
        } for your ${bid.bidType === "LOAD_BID" ? "load" : "truck"} from ${
          bid.source.placeName
        } to ${bid.destination.placeName}`,
      };

      const data = {
        bidId: bid._id.toString(),
        type: "BID_PLACED",
        click_action: "BID_NOTIFICATION",
        loadId: bid.loadId.toString(),
        senderId: bid.bidBy.toString(),
        senderName: sender.name,
        timestamp: new Date().toISOString(),
      };

      // Send notifications to all tokens
      const results = await Promise.all(
        tokens.map(async (token) => {
          try {
            return await this.sendNotification(token, notification, data);
          } catch (error) {
            console.error(
              `Error sending notification to token ${token}:`,
              error
            );
            return error;
          }
        })
      );

      // Handle invalid tokens cleanup
      const invalidTokens = tokens.filter((token, index) => {
        const error = results[index] instanceof Error ? results[index] : null;
        return error && this.isTokenInvalid(error);
      });

      if (invalidTokens.length > 0) {
        console.log("Removing invalid tokens:", invalidTokens);
        receiver.deviceTokens = receiver.deviceTokens.filter(
          (device) => !invalidTokens.includes(device.token)
        );
        await receiver.save();
      }
    } catch (error) {
      console.error("Error sending bid placed notification:", error);
      console.error("Error details:", error.stack);
    }
  }

  static async sendBidStatusUpdateNotification(bid, status) {
    try {
      // Get receiver's device tokens (bid placer)
      const receiver = await User.findById(bid.bidBy);
      if (
        !receiver ||
        !receiver.deviceTokens ||
        receiver.deviceTokens.length === 0
      ) {
        console.log("No device tokens found for receiver:", bid.bidBy);
        return;
      }

      // Populate the bid with necessary references
      const populatedBid = await bid.populate([
        { path: "offeredTo", select: "name" },
        { path: "loadId", select: "materialType" },
      ]);

      const sender = populatedBid.offeredTo;
      const tokens = receiver.deviceTokens.map((device) => device.token);
      console.log("Sending bid status update notification to tokens:", tokens);

      const notification = {
        title: status === "ACCEPTED" ? "🎉 Bid Accepted!" : "❌ Bid Rejected",
        body:
          status === "ACCEPTED"
            ? `Your bid of ₹${bid.biddedAmount.total} for the ${
                bid.bidType === "LOAD_BID" ? "load" : "truck"
              } from ${bid.source.placeName} to ${
                bid.destination.placeName
              } has been accepted!`
            : `Your bid of ₹${bid.biddedAmount.total} for the ${
                bid.bidType === "LOAD_BID" ? "load" : "truck"
              } from ${bid.source.placeName} to ${
                bid.destination.placeName
              } was not accepted.`,
      };

      const data = {
        bidId: bid._id.toString(),
        type: "BID_STATUS_UPDATE",
        status: status,
        click_action: "BID_NOTIFICATION",
        loadId: bid.loadId.toString(),
        senderId: bid.offeredTo.toString(),
        senderName: sender.name,
        materialType: bid.materialType,
        timestamp: new Date().toISOString(),
      };

      // Send notifications to all tokens
      const results = await Promise.all(
        tokens.map(async (token) => {
          try {
            return await this.sendNotification(token, notification, data);
          } catch (error) {
            console.error(
              `Error sending notification to token ${token}:`,
              error
            );
            return error;
          }
        })
      );

      // Handle invalid tokens cleanup
      const invalidTokens = tokens.filter((token, index) => {
        const error = results[index] instanceof Error ? results[index] : null;
        return error && this.isTokenInvalid(error);
      });

      if (invalidTokens.length > 0) {
        console.log("Removing invalid tokens:", invalidTokens);
        receiver.deviceTokens = receiver.deviceTokens.filter(
          (device) => !invalidTokens.includes(device.token)
        );
        await receiver.save();
      }
    } catch (error) {
      console.error("Error sending bid status update notification:", error);
      console.error("Error details:", error.stack);
    }
  }
}

module.exports = NotificationService;
