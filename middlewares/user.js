const User = require("../models/user");
const BigPromise = require("./BigPromise");
const CustomError = require("../utils/CustomError");
const jwt = require("jsonwebtoken");

exports.isLoggedIn = BigPromise(async (req, res, next) => {
  const token =
    req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");

  console.log("token", req.cookies);

  if (!token) {
    return next(new CustomError("Please login to get access", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log("decoded", decoded);

  req.user = await User.findById(decoded.id);

  next();
});
