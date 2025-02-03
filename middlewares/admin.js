const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const CustomError = require("../utils/CustomError");
const BigPromise = require("./BigPromise");

exports.isAdmin = BigPromise(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the token belongs to an admin
    if (decoded.role !== "admin") {
      return next(new CustomError("Not authorized to access this route", 403));
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return next(new CustomError("Admin not found", 404));
    }

    req.admin = admin;
    next();
  } catch (error) {
    return next(new CustomError("Not authorized to access this route", 401));
  }
}); 