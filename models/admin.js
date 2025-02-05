const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please add a username"],
    unique: true,
    trim: true,
    maxlength: [50, "Username cannot be more than 50 characters"],
  },
  userLevel: {
    type: Number,
    required: [true, "Please add a user level"],
    default: 1,
  },
  phone: {
    type: String,
    required: [true, "Please add a phone number"],
    unique: true,
    maxlength: [10, "Phone number cannot be more than 10 characters"],
    minlength: [10, "Phone number cannot be less than 10 characters"],
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  otp: {
    code: {
      type: String,
    },
    expiry: {
      type: Date,
    },
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt password using bcrypt
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Generate OTP
adminSchema.methods.generateOtp = function () {
  const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
  this.otp = {
    code: otpCode,
    expiry: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  return otpCode;
};

// Validate OTP
adminSchema.methods.validateOtp = function (inputOtp) {
  if (this.otp && this.otp.code === inputOtp && this.otp.expiry > Date.now()) {
    return true;
  }
  return false;
};

// Match password
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
adminSchema.methods.getJwtToken = function () {
  return jwt.sign({ id: this._id, role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = mongoose.model("Admin", adminSchema); 