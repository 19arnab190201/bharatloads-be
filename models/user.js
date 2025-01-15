const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"],
  },
  companyName: {
    type: String,
    trim: true,
    maxlength: [100, "Company name cannot be more than 100 characters"],
  },
  companyLocation: {
    type: String,
    trim: true,
  },
  mobile: {
    countryCode: {
      type: String,
      required: [true, "Please add a country code"],
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
      unique: true,
      maxlength: [10, "Phone number cannot be more than 10 characters"],
      minlength: [10, "Phone number cannot be less than 10 characters"],
    },
  },
  userType: {
    type: String,
    enum: ["ADMIN", "TRANSPORTER", "TRUCKER"],
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
  BlCoins: {
    type: Number,
    default: 0,
  },
});

// Generate OTP
userSchema.methods.generateOtp = function () {
  // Generate a 5-digit OTP
  const otpCode = Math.floor(10000 + Math.random() * 90000).toString();

  // Set OTP and expiry (15 minutes)
  this.otp = {
    code: otpCode,
    expiry: Date.now() + 15 * 60 * 1000, // 15 minutes from now
  };

  return otpCode;
};

// Validate OTP
userSchema.methods.validateOtp = function (inputOtp) {
  if (this.otp && this.otp.code === inputOtp && this.otp.expiry > Date.now()) {
    return true;
  }
  return false;
};

// generate coins on suuccessful booking
userSchema.methods.generateCoins = function (amount) {
  //generate coins 5% of the total amount
  const DISCOUNT_PERCENTAGE = 5;
  const coins = Math.floor((amount * DISCOUNT_PERCENTAGE) / 100);
  this.BlCoins += coins;

  return coins;
};

// Generate JWT token
userSchema.methods.getJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = mongoose.model("User", userSchema);
