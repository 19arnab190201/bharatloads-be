const LoadPost = require("../../models/loadPost");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");
const EventLogger = require("../../utils/eventLogger");

/**
 * @desc    Get all loads with pagination and stats
 * @route   GET /api/v1/admin/loads
 * @access  Private/Admin
 */
exports.getLoads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      materialType,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (materialType) {
      query.materialType = materialType;
    }

    if (search) {
      query.$or = [
        { "source.placeName": { $regex: search, $options: "i" } },
        { "destination.placeName": { $regex: search, $options: "i" } },
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
    const [totalLoads, activeLoads] = await Promise.all([
      LoadPost.countDocuments({}),
      LoadPost.countDocuments({ isActive: true }),
    ]);

    // Get paginated loads with transporter details
    const loads = await LoadPost.find(query)
      .populate({
        path: "transporterId",
        select: "name mobile companyName",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await LoadPost.countDocuments(query);

    res.status(200).json({
      loads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + loads.length < total,
      },
      stats: {
        totalLoads,
        activeLoads,
      },
    });
  } catch (error) {
    console.error("Error in getLoads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Get load by ID with full details
 * @route   GET /api/v1/admin/loads/:id
 * @access  Private/Admin
 */
exports.getLoadById = async (req, res) => {
  try {
    const load = await LoadPost.findById(req.params.id)
      .populate({
        path: "transporterId",
        select: "name mobile companyName companyLocation",
      })
      .populate({
        path: "bids",
        populate: {
          path: "bidBy",
          select: "name mobile companyName",
        },
      });

    if (!load) {
      return res.status(404).json({
        success: false,
        message: "Load not found",
      });
    }

    res.status(200).json({
      success: true,
      load,
    });
  } catch (error) {
    console.error("Error in getLoadById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getLoadsByUserId = async (req, res) => {
  try {
    const loads = await LoadPost.find({ transporterId: req.params.id });
    res.status(200).json({
      success: true,
      loads,
    });
  } catch (error) {
    console.error("Error in getLoadsByUserId:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Update load by ID
 * @route   PUT /api/v1/admin/loads/:id
 * @access  Private/Admin
 */
exports.updateLoadById = BigPromise(async (req, res, next) => {
  const { id } = req.params;
  const {
    materialType,
    weight,
    source,
    destination,
    vehicleBodyType,
    vehicleType,
    numberOfWheels,
    offeredAmount,
    whenNeeded,
    scheduleDate,
    isActive,
    expiresAt
  } = req.body;

  if (!id) {
    return next(new CustomError("Load ID is required", 400));
  }

  const load = await LoadPost.findById(id);
  if (!load) {
    return next(new CustomError("Load not found", 404));
  }

  // Store old values for logging
  const oldValues = {
    materialType: load.materialType,
    weight: load.weight,
    source: { ...load.source.toObject() },
    destination: { ...load.destination.toObject() },
    vehicleBodyType: load.vehicleBodyType,
    vehicleType: load.vehicleType,
    numberOfWheels: load.numberOfWheels,
    offeredAmount: { ...load.offeredAmount.toObject() },
    whenNeeded: load.whenNeeded,
    scheduleDate: load.scheduleDate,
    isActive: load.isActive,
    expiresAt: load.expiresAt
  };

  // Update load fields if provided
  if (materialType) load.materialType = materialType;
  if (weight) load.weight = weight;
  
  if (source) {
    if (source.placeName) load.source.placeName = source.placeName;
    if (source.coordinates && source.coordinates.length === 2) {
      load.source.coordinates = source.coordinates;
    }
  }
  
  if (destination) {
    if (destination.placeName) load.destination.placeName = destination.placeName;
    if (destination.coordinates && destination.coordinates.length === 2) {
      load.destination.coordinates = destination.coordinates;
    }
  }
  
  if (vehicleBodyType) load.vehicleBodyType = vehicleBodyType;
  if (vehicleType) load.vehicleType = vehicleType;
  if (numberOfWheels) load.numberOfWheels = numberOfWheels;
  
  if (offeredAmount) {
    if (offeredAmount.total) load.offeredAmount.total = offeredAmount.total;
    if (offeredAmount.advanceAmount) load.offeredAmount.advanceAmount = offeredAmount.advanceAmount;
    if (offeredAmount.dieselAmount) load.offeredAmount.dieselAmount = offeredAmount.dieselAmount;
  }
  
  // Handle whenNeeded and scheduleDate together to ensure consistency
  if (whenNeeded) {
    load.whenNeeded = whenNeeded;
    
    // If whenNeeded is IMMEDIATE, set scheduleDate to null or current date
    if (whenNeeded === "IMMEDIATE") {
      load.scheduleDate = new Date(); // Set to current date to satisfy validation
    } 
    // If whenNeeded is SCHEDULED, ensure scheduleDate is provided
    else if (whenNeeded === "SCHEDULED") {
      if (scheduleDate) {
        load.scheduleDate = new Date(scheduleDate);
      } else if (!load.scheduleDate) {
        // If no scheduleDate is provided and there isn't one already, set a default
        load.scheduleDate = new Date();
      }
    }
  } else if (scheduleDate) {
    // If only scheduleDate is provided without whenNeeded
    load.scheduleDate = new Date(scheduleDate);
  }
  
  if (isActive !== undefined) load.isActive = isActive;
  if (expiresAt) load.expiresAt = expiresAt;

  await load.save();

  try {
    // Log the update event
    if (req.admin) {
      await EventLogger.log({
        entityType: "LOAD_POST",
        entityId: load._id,
        event: EventLogger.EVENTS.LOAD.UPDATED,
        description: `Admin updated load from ${oldValues.source.placeName} to ${oldValues.destination.placeName}`,
        performedBy: req.admin.id,
        performedByModel: "Admin",
        changes: {
          materialType: materialType ? { from: oldValues.materialType, to: materialType } : undefined,
          weight: weight ? { from: oldValues.weight, to: weight } : undefined,
          source: source ? {
            from: `${oldValues.source.placeName}`,
            to: `${load.source.placeName}`
          } : undefined,
          destination: destination ? {
            from: `${oldValues.destination.placeName}`,
            to: `${load.destination.placeName}`
          } : undefined,
          vehicleBodyType: vehicleBodyType ? { from: oldValues.vehicleBodyType, to: vehicleBodyType } : undefined,
          vehicleType: vehicleType ? { from: oldValues.vehicleType, to: vehicleType } : undefined,
          numberOfWheels: numberOfWheels ? { from: oldValues.numberOfWheels, to: numberOfWheels } : undefined,
          offeredAmount: offeredAmount ? {
            from: `Total: ₹${oldValues.offeredAmount.total}, Advance: ₹${oldValues.offeredAmount.advanceAmount}, Diesel: ₹${oldValues.offeredAmount.dieselAmount}`,
            to: `Total: ₹${load.offeredAmount.total}, Advance: ₹${load.offeredAmount.advanceAmount}, Diesel: ₹${load.offeredAmount.dieselAmount}`
          } : undefined,
          whenNeeded: whenNeeded ? { from: oldValues.whenNeeded, to: whenNeeded } : undefined,
          scheduleDate: scheduleDate ? { 
            from: oldValues.scheduleDate ? oldValues.scheduleDate.toISOString() : null, 
            to: load.scheduleDate ? load.scheduleDate.toISOString() : null 
          } : undefined,
          isActive: isActive !== undefined ? { from: oldValues.isActive, to: isActive } : undefined,
          expiresAt: expiresAt ? { 
            from: oldValues.expiresAt ? oldValues.expiresAt.toISOString() : null, 
            to: load.expiresAt ? load.expiresAt.toISOString() : null 
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
    message: "Load updated successfully",
    load
  });
});
