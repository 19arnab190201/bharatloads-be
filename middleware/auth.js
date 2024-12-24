const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Middleware to protect routes
exports.protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    User.findById(decoded.id)
      .select("-otp")
      .then((user) => {
        if (!user) {
          return res
            .status(401)
            .json({ message: "Not authorized, user not found" });
        }

        req.user = user;
        next();
      })
      .catch((err) => {
        return res
          .status(401)
          .json({ message: "Not authorized, token failed" });
      });
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Middleware to authorize roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({
        message: `User type ${req.user.userType} is not authorized to access this route`,
      });
    }
    next();
  };
};
