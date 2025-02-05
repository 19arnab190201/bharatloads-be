const Truck = require("../../models/truck");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Get all trucks with pagination and stats
 * @route   GET /api/v1/admin/trucks
 * @access  Private/Admin
 */
exports.getTrucks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      truckType,
      isRCVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (truckType) {
      query.truckType = truckType;
    }

    if (isRCVerified !== undefined) {
      query.isRCVerified = isRCVerified === "true";
    }

    if (search) {
      query.$or = [
        { truckNumber: { $regex: search, $options: "i" } },
        { "truckLocation.placeName": { $regex: search, $options: "i" } },
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
    const [totalTrucks, verifiedTrucks, pendingVerification] = await Promise.all([
      Truck.countDocuments({}),
      Truck.countDocuments({ isRCVerified: true }),
      Truck.countDocuments({ RCVerificationStatus: "PENDING" }),
    ]);

    // Get paginated trucks with owner details
    const trucks = await Truck.find(query)
      .populate({
        path: "truckOwner",
        select: "name mobile userType",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-RCImage"); // Exclude heavy RC image data

    // Get total count for pagination
    const total = await Truck.countDocuments(query);

    res.status(200).json({
      trucks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + trucks.length < total,
      },
      stats: {
        totalTrucks,
        verifiedTrucks,
        pendingVerification,
      },
    });
  } catch (error) {
    console.error("Error in getTrucks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Get truck by ID with full details
 * @route   GET /api/v1/admin/trucks/:id
 * @access  Private/Admin
 */
exports.getTruckById = async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id)
      .populate({
        path: "truckOwner",
        select: "name mobile userType companyName companyLocation",
      })
      .populate({
        path: "bids",
        populate: {
          path: "bidBy",
          select: "name mobile companyName",
        },
      });

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: "Truck not found",
      });
    }

    res.status(200).json({
      success: true,
      truck,
    });
  } catch (error) {
    console.error("Error in getTruckById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Update truck verification status
 * @route   PUT /api/v1/admin/trucks/:id/verify
 * @access  Private/Admin
 */
exports.verifyTruck = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status",
      });
    }

    const truck = await Truck.findByIdAndUpdate(
      req.params.id,
      {
        RCVerificationStatus: status,
        isRCVerified: status === "APPROVED",
      },
      { new: true }
    ).populate({
      path: "truckOwner",
      select: "name mobile userType",
    });

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: "Truck not found",
      });
    }

    res.status(200).json({
      success: true,
      truck,
    });
  } catch (error) {
    console.error("Error in verifyTruck:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
