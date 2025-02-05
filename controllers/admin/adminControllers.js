const Admin = require("../../models/admin");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");
const { sendOTP } = require("../../utils/sendOTP");
const User = require("../../models/user");

exports.signup = BigPromise(async (req, res) => {
  const { username, phone, password } = req.body;

  // Validate input
  if (!username || !phone || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Check if admin already exists
  let admin = await Admin.findOne({ $or: [{ username }, { phone }] });
  if (admin) {
    return res.status(400).json({ message: "Admin already exists." });
  }

  // Create a new admin
  admin = new Admin({ username, phone, password });

  // Generate OTP
  const otpCode = admin.generateOtp();
  await admin.save();

  // Send OTP
  console.log(`OTP for ${phone}: ${otpCode}`);
  const success = sendOTP(phone, otpCode);
  if (!success) {
    return res.status(500).json({ message: "Failed to send OTP." });
  }

  res.status(201).json({
    message: "Signup successful. OTP sent to your phone.",
  });
});

exports.login = BigPromise(async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: "Please provide username and password" });
  }

  try {
    // Find admin by username and explicitly select password
    const admin = await Admin.findOne({ username }).select("+password");
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate OTP for 2FA
    const otpCode = admin.generateOtp();
    await admin.save();

    // Send OTP
    console.log(`Login OTP for ${admin.phone}: ${otpCode}`);
    const success = sendOTP(admin.phone, otpCode);
    if (!success) {
      return res.status(500).json({ message: "Failed to send OTP." });
    }

    // Send back admin info (except sensitive data)
    res.status(200).json({
      message: "OTP sent to your phone.",
      admin: {
        username: admin.username,
        phone: admin.phone
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Error during login process" });
  }
});

exports.verifyOtp = BigPromise(async (req, res) => {
  const { username, otp } = req.body;

  // Validate input
  if (!username || !otp) {
    return res.status(400).json({ message: "Username and OTP are required." });
  }

  // Find admin by username
  const admin = await Admin.findOne({ username });
  if (!admin) {
    return res.status(404).json({ message: "Admin not found." });
  }

  // Validate OTP
  if (!admin.validateOtp(otp)) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  // Mark admin as verified
  admin.isVerified = true;
  admin.otp = undefined; // Clear OTP
  await admin.save();

  // Generate JWT token
  const token = admin.getJwtToken();

  res.status(200).json({
    message: "OTP verified successfully.",
    token,
    admin: {
      id: admin._id,
      username: admin.username,
      phone: admin.phone,
    },
  });
});

exports.getProfile = BigPromise(async (req, res) => {
  const admin = await Admin.findById(req.admin.id);
  if (!admin) {
    return res.status(404).json({ message: "Admin not found." });
  }

  res.status(200).json({
    success: true,
    admin: {
      id: admin._id,
      username: admin.username,
      phone: admin.phone,
      userLevel: admin.userLevel,
    },
  });
});

/**
 * @desc    Get all users with pagination and stats
 * @route   GET /api/v1/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      userType,
      isVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (userType) {
      query.userType = userType;
    }

    if (isVerified !== undefined) {
      query.isVerified = isVerified === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { "mobile.phone": { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total counts for stats
    const [totalUsers, totalTruckers, totalTransporters] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ userType: "TRUCKER" }),
      User.countDocuments({ userType: "TRANSPORTER" }),
    ]);

    // Get paginated users
    const users = await User.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-otp -deviceTokens");

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + users.length < total,
      },
      stats: {
        totalUsers,
        totalTruckers,
        totalTransporters,
      },
    });
  } catch (error) {
    console.error("Error in getUsers:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/v1/admin/users/:id
 * @access  Private/Admin
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-otp -deviceTokens");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}; 