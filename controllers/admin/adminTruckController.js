const Truck = require("../../models/truck");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");
const EventLogger = require("../../utils/eventLogger");

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

/**
 * @desc    Get trucks by user ID
 * @route   GET /api/v1/admin/trucks/user/:id
 * @access  Private/Admin
 */
exports.getTrucksByUserId = async (req, res) => {
  try {
    const trucks = await Truck.find({ truckOwner: req.params.id });
    res.status(200).json({
      success: true,
      trucks,
    });
  } catch (error) {
    console.error("Error in getTrucksByUserId:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Update truck by ID
 * @route   PUT /api/v1/admin/trucks/:id
 * @access  Private/Admin
 */
exports.updateTruckById = BigPromise(async (req, res, next) => {
  const { id } = req.params;
  const {
    truckNumber,
    truckLocation,
    truckCapacity,
    vehicleBodyType,
    truckBodyType,
    truckType,
    truckTyre,
    isActive,
    expiresAt
  } = req.body;

  if (!id) {
    return next(new CustomError("Truck ID is required", 400));
  }

  const truck = await Truck.findById(id);
  if (!truck) {
    return next(new CustomError("Truck not found", 404));
  }

  // Store old values for logging
  const oldValues = {
    truckNumber: truck.truckNumber,
    truckLocation: { ...truck.truckLocation.toObject() },
    truckCapacity: truck.truckCapacity,
    vehicleBodyType: truck.vehicleBodyType,
    truckBodyType: truck.truckBodyType,
    truckType: truck.truckType,
    truckTyre: truck.truckTyre,
    isActive: truck.isActive,
    expiresAt: truck.expiresAt
  };

  // Update truck fields if provided
  if (truckNumber) truck.truckNumber = truckNumber;
  
  if (truckLocation) {
    if (truckLocation.placeName) truck.truckLocation.placeName = truckLocation.placeName;
    if (truckLocation.coordinates && truckLocation.coordinates.length === 2) {
      truck.truckLocation.coordinates = truckLocation.coordinates;
    }
  }
  
  if (truckCapacity) truck.truckCapacity = truckCapacity;
  if (vehicleBodyType) truck.vehicleBodyType = vehicleBodyType;
  if (truckBodyType) truck.truckBodyType = truckBodyType;
  if (truckType) truck.truckType = truckType;
  if (truckTyre) truck.truckTyre = truckTyre;
  if (isActive !== undefined) truck.isActive = isActive;
  if (expiresAt) truck.expiresAt = expiresAt;

  await truck.save();

  try {
    // Log the update event
    if (req.admin) {
      await EventLogger.log({
        entityType: "TRUCK",
        entityId: truck._id,
        event: EventLogger.EVENTS.TRUCK.UPDATED,
        description: `Admin updated truck ${truck.truckNumber}`,
        performedBy: req.admin.id,
        performedByModel: "Admin",
        changes: {
          truckNumber: truckNumber ? { from: oldValues.truckNumber, to: truckNumber } : undefined,
          truckLocation: truckLocation ? {
            from: `${oldValues.truckLocation.placeName}`,
            to: `${truck.truckLocation.placeName}`
          } : undefined,
          truckCapacity: truckCapacity ? { from: oldValues.truckCapacity, to: truckCapacity } : undefined,
          vehicleBodyType: vehicleBodyType ? { from: oldValues.vehicleBodyType, to: vehicleBodyType } : undefined,
          truckBodyType: truckBodyType ? { from: oldValues.truckBodyType, to: truckBodyType } : undefined,
          truckType: truckType ? { from: oldValues.truckType, to: truckType } : undefined,
          truckTyre: truckTyre ? { from: oldValues.truckTyre, to: truckTyre } : undefined,
          isActive: isActive !== undefined ? { from: oldValues.isActive, to: isActive } : undefined,
          expiresAt: expiresAt ? { 
            from: oldValues.expiresAt ? oldValues.expiresAt.toISOString() : null, 
            to: truck.expiresAt ? truck.expiresAt.toISOString() : null 
          } : undefined
        }
      });
    } else {
      console.log("Admin user not found in request, skipping event logging");
    }
  } catch (error) {
    console.error("Error logging event:", error);
    // Don't throw error to prevent disrupting main operation
  }

  res.status(200).json({
    success: true,
    message: "Truck updated successfully",
    truck
  });
}); 