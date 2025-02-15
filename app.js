const express = require("express");
const User = require("./models/user");
const jwt = require("jsonwebtoken");
const cors = require("cors");

require("dotenv").config();
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");

const app = express();

// Increase payload size limit
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Replace manual CORS with cors package
app.use(cors({
  origin: "https://bharatloads-be-cd9fce57f28d.herokuapp.com",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Requested-With", "X-HTTP-Method-Override", "Accept", "Authorization"]
}));

//Morgan middleware
app.use(morgan("tiny"));

//cookie parser middleware
app.use(cookieParser());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  })
);

const user = require("./routes/user");
const home = require("./routes/home");
const load = require("./routes/load-routes");
const truck = require("./routes/truck-routes");
const bid = require("./routes/bid-routes");
const chat = require("./routes/chat-routes");
const admin = require("./routes/admin-routes");
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
app.use("/api/v1", admin);


//exporting app js
module.exports = app;
