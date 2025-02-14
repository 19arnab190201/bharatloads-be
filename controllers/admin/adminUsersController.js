const Admin = require("../../models/admin");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Get all admin users
 * @route   GET /api/v1/admin/users/admins
 * @access  Private/SuperAdmin
 */
exports.getAllAdmins = BigPromise(async (req, res) => {
  try {
    // Get all admins except the current admin
    console.log("name");
    //find all admins
    const admins = await Admin.find({}).select("-password -otp");

    res.status(200).json({
      admins,
      total: admins.length,
    });
  } catch (error) {
    console.error("Error in getAllAdmins:", error);
    throw new CustomError("Failed to fetch admin users", 500);
  }
});

/**
 * @desc    Create a new admin user
 * @route   POST /api/v1/admin/users/create
 * @access  Private/SuperAdmin
 */
exports.createAdmin = BigPromise(async (req, res) => {
  try {
    const { username, phone, password, userLevel } = req.body;

    // Validate input
    if (!username || !phone || !password || !userLevel) {
      throw new CustomError("All fields are required", 400);
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { phone }],
    });

    if (existingAdmin) {
      throw new CustomError(
        "Admin with this username or phone already exists",
        400
      );
    }

    // Create new admin
    const admin = await Admin.create({
      username,
      phone,
      password,
      userLevel: parseInt(userLevel),
      isVerified: true, // Since created by super admin
    });

    // Remove sensitive data
    admin.password = undefined;
    admin.otp = undefined;

    res.status(201).json({
      message: "Admin user created successfully",
      admin,
    });
  } catch (error) {
    console.error("Error in createAdmin:", error);
    if (error instanceof CustomError) throw error;
    throw new CustomError("Failed to create admin user", 500);
  }
});

/**
 * @desc    Update an admin user
 * @route   PUT /api/v1/admin/users/:id
 * @access  Private/SuperAdmin
 */
exports.updateAdmin = BigPromise(async (req, res) => {
  try {
    console.log("updateAdmin");
    const { id } = req.params;
    const { username, phone, password, userLevel } = req.body;

    // Find admin
    const admin = await Admin.findById(id);
    if (!admin) {
      throw new CustomError("Admin user not found", 404);
    }

    // Check if updating username or phone conflicts with existing admin
    if (username !== admin.username || phone !== admin.phone) {
      const existingAdmin = await Admin.findOne({
        _id: { $ne: id },
        $or: [{ username }, { phone }],
      });

      if (existingAdmin) {
        throw new CustomError(
          "Admin with this username or phone already exists",
          400
        );
      }
    }

    // Update fields
    admin.username = username;
    admin.phone = phone;
    admin.userLevel = parseInt(userLevel);

    // Only update password if provided
    if (password) {
      admin.password = password;
    }

    await admin.save();

    // Remove sensitive data
    admin.password = undefined;
    admin.otp = undefined;

    res.status(200).json({
      message: "Admin user updated successfully",
      admin,
    });
  } catch (error) {
    console.error("Error in updateAdmin:", error);
    if (error instanceof CustomError) throw error;
    throw new CustomError("Failed to update admin user", 500);
  }
}); 