const User = require("../models/user");
const { sendOTP } = require("../utils/sendOTP");

const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");
const sendToken = require("../utils/token");
const EventLogger = require("../utils/eventLogger");

exports.signup = BigPromise(async (req, res) => {
  const { name, mobile, userType, companyName, companyLocation } = req.body;

  // Validate input
  if (!name || !mobile || !mobile.phone || !mobile.countryCode || !userType) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Check if user already exists
  let user = await User.findOne({ "mobile.phone": mobile.phone });
  if (user) {
    return res.status(400).json({ message: "User already exists." });
  }

  // Create a new user
  user = new User({
    name,
    mobile,
    userType,
    companyName,
    companyLocation,
  });

  // Generate OTP
  const otpCode = user.generateOtp();
  await user.save();

  // Send OTP (simulated response for development)
  console.log(`OTP for ${mobile.phone}: ${otpCode}`);
  const success = sendOTP(mobile.phone, otpCode);
  if (!success) {
    return res.status(500).json({ message: "Failed to send OTP." });
  }

  // Log the user creation event
  await EventLogger.log({
    entityType: "USER",
    entityId: user._id,
    event: EventLogger.EVENTS.USER.CREATED,
    description: `New user ${user.name} registered`,
    performedBy: user._id,
    metadata: {
      userType: user.userType,
      phone: user.mobile.phone,
    },
  });

  res.status(201).json({
    message: "Signup successful. OTP sent to your phone.",
  });
});

exports.verifyOtp = BigPromise(async (req, res) => {
  const { phone, otp } = req.body;

  // Validate input
  if (!phone || !otp) {
    return res
      .status(400)
      .json({ message: "Phone number and OTP are required." });
  }

  // Find user by phone
  const user = await User.findOne({ "mobile.phone": phone });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Validate OTP
  if (!user.validateOtp(otp)) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  // Mark user as verified
  user.isVerified = true;
  user.otp = undefined; // Clear OTP

  // Log login activity
  await user.logActivity("LOGIN");
  await user.save();

  // Generate JWT token
  const token = user.getJwtToken();

  // Log the verification event
  await EventLogger.log({
    entityType: "USER",
    entityId: user._id,
    event: EventLogger.EVENTS.USER.LOGGED_IN,
    description: `User ${user.name} logged in`,
    performedBy: user._id,
    metadata: {
      userType: user.userType,
      phone: user.mobile.phone,
    },
  });

  res.status(200).json({
    message: "OTP verified successfully.",
    token,
    user,
  });
});

exports.resendOtp = BigPromise(async (req, res) => {
  const { phone } = req.body;

  // Validate input
  if (!phone) {
    return res.status(400).json({ message: "Phone number is required." });
  }

  // Find user by phone
  const user = await User.findOne({ "mobile.phone": phone });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Generate new OTP
  const otpCode = user.generateOtp();
  await user.save();

  // Send OTP (simulated response for development)
  console.log(`Resent OTP for ${phone}: ${otpCode}`);

  res.status(200).json({
    message: "OTP resent successfully.",
  });
});

exports.login = BigPromise(async (req, res) => {
  const { mobile } = req.body;

  const { countryCode, phone } = mobile;

  // Validate input
  if (!phone || !countryCode) {
    console.log("phone", phone);
    return res.status(400).json({ message: "Phone number is required." });
  }

  // Find user by phone
  const user = await User.findOne({ "mobile.phone": phone });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Generate OTP
  const otpCode = user.generateOtp();
  await user.save();

  // Send OTP (simulated response for development)
  console.log(`Login OTP for ${phone}: ${otpCode}`);
  const success = sendOTP(phone, otpCode);
  if (!success) {
    return res.status(500).json({ message: "Failed to send OTP." });
  }

  res.status(200).json({
    message: "OTP sent to your phone.",
  });
});

exports.logout = BigPromise(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

exports.getLoggedInUserDetails = BigPromise(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new CustomError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    user,
  });
});
exports.getUserCoins = BigPromise(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    coins: user.BlCoins || 0,
  });
});

exports.updateUserDetails = BigPromise(async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    throw new CustomError("Please provide a name", 400);
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new CustomError("User not found", 404);
  }

  const oldName = user.name;
  user.name = name;

  // Log profile update activity
  await user.logActivity("PROFILE_UPDATED", {
    field: "name",
    oldValue: oldName,
    newValue: name,
  });

  await user.save();

  // Log the update event
  await EventLogger.log({
    entityType: "USER",
    entityId: user._id,
    event: EventLogger.EVENTS.USER.UPDATED,
    description: `User ${user.name} updated their profile`,
    performedBy: req.user._id,
    changes: {
      name: {
        from: oldName,
        to: name,
      },
    },
  });

  res.status(200).json({
    success: true,
    user,
  });
});

exports.updateDeviceToken = BigPromise(async (req, res, next) => {
  const { token, platform } = req.body;

  if (!token || !platform) {
    return next(new CustomError("Token and platform are required", 400));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new CustomError("User not found", 404));
  }

  await user.updateDeviceToken(token, platform);

  res.status(200).json({
    success: true,
    message: "Device token updated successfully",
  });
});

exports.getUsers = BigPromise(async (req, res, next) => {
  console.log("getUsers");
  const users = await User.find();
  res.status(200).json({
    success: true,
    users,
  });
});

// Add new endpoint to get user activity
exports.getUserActivity = BigPromise(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new CustomError("User not found", 404);
  }

  // Get activity log sorted by most recent
  const activityLog = user.activityLog.sort(
    (a, b) => b.timestamp - a.timestamp
  );

  res.status(200).json({
    success: true,
    lastActivity: user.lastActivity,
    activityLog,
  });
});
