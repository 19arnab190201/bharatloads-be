const express = require("express");
const User = require("./models/user");
const Chat = require("./models/chat");
const Message = require("./models/message");
const jwt = require("jsonwebtoken");
const http = require("http");
const socketIo = require("socket.io");

require("dotenv").config();
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");

const app = express();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", req.headers.origin);

  res.header(
    "Access-Control-Allow-Headers",
    "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept"
  );
  next();
});

//Morgan middleware
app.use(morgan("tiny"));

//cookie parser middleware
app.use(cookieParser());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

const user = require("./routes/user");
const home = require("./routes/home");
const load = require("./routes/load-routes");
const truck = require("./routes/truck-routes");
const bid = require("./routes/bid-routes");
const chat = require("./routes/chat-routes");

//regular middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//AUTHENTICATION VALIDATION ROUTE
app.get("/api/v1/auth", async (req, res) => {
  //Check for Bearer token in header

  try {
    const bearerHeader = req.headers["authorization"];
    if (!bearerHeader) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];

    console.log(bearerToken);

    const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    res.status(200).json({
      isValid: true,
      user,
      message: "Token is valid",
    });
  } catch (error) {
    console.log(error);
    res.status(401).json({
      isValid: false,
      message: "Token is invalid",
    });
  }

  // try {
  //   if (!token) {
  //     console.log("token", token);
  //     return next(new CustomError("Please login to get access", 401));
  //   }
  //   console.log("token", token);
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   const user = await User.findById(decoded.id);

  //   res.status(200).json({
  //     isValid: true,
  //     user,
  //     message: "Token is valid",
  //   });
  // } catch (error) {
  //   res.status(401).json({
  //     isValid: false,
  //     message: "Token is invalid",
  //   });
  // }
});

//MIDDLEWARE
app.use("/api/v1", user);
app.use("/api/v1", home);
app.use("/api/v1", load);
app.use("/api/v1", truck);
app.use("/api/v1", bid);
app.use("/api/v1", chat);

//exporting app js
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Authorization"]
  },
  path: "/socket.io"
});

// Add authentication middleware for socket.io
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected");

  // Join user to their personal room
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // Handle new message
  socket.on("sendMessage", async (data) => {
    try {
      const { chatId, content, senderId } = data;

      // Save message to database
      const message = await Message.create({
        chat: chatId,
        sender: senderId,
        content,
        readBy: [senderId]
      });

      // Populate sender details
      await message.populate('sender', 'name mobile userType');

      // Update last message in chat
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id
      });

      // Get chat to find participants
      const chat = await Chat.findById(chatId);

      // Emit message to all participants including sender
      chat.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit("newMessage", {
          message,
          chat: chatId
        });
      });

    } catch (error) {
      console.error("Message sending failed:", error);
    }
  });

  // Handle message read status
  socket.on("messageRead", async (data) => {
    const { messageId, userId } = data;
    
    try {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: userId }
      });
    } catch (error) {
      console.error("Message status update failed:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

module.exports = { app, server };
