const Truck = require("../models/truck");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");
const EventLogger = require("../utils/eventLogger");
const User = require("../models/user");

// @desc    Create a new truck
// @route   POST /api/trucks
// @access  Private
exports.createTruck = BigPromise(async (req, res, next) => {
  // Add the logged-in user's ID to the truck owner
  req.body.truckOwner = req.user.id;

  // Validate required fields
  const {
    truckOwner,
    truckPermit,
    truckNumber,
    truckLocation,
    truckCapacity,
    vehicleBodyType,
    truckType,
    truckBodyType,
    truckTyre,
    RCImage,
  } = req.body;

  // Ensure truckLocation contains placeName and coordinates
  if (
    !truckLocation ||
    !truckLocation.placeName ||
    !truckLocation.coordinates
  ) {
    return next(
      new CustomError(
        "Please provide a valid truck location with place name and coordinates",
        400
      )
    );
  }

  // Ensure all other required fields are present
  if (
    !truckOwner ||
    !truckPermit ||
    !truckNumber ||
    !truckCapacity ||
    !vehicleBodyType ||
    !truckType ||
    !truckBodyType ||
    !truckTyre ||
    !RCImage
  ) {
    return next(
      new CustomError("Please provide all required truck details", 400)
    );
  }

  req.body.truckLocation = {
    placeName: truckLocation.placeName,
    coordinates: [
      truckLocation.coordinates.longitude,
      truckLocation.coordinates.latitude,
    ],
  };

  // Validate truck number uniqueness
  const existingTruck = await Truck.findOne({
    truckNumber: req.body.truckNumber,
  });
  if (existingTruck) {
    return next(new CustomError("Truck number must be unique", 400));
  }

  // Create the truck
  const truck = await Truck.create(req.body);

  // Log user activity
  const user = await User.findById(req.user.id);
  await user.logActivity("TRUCK_POSTED", {
    truckId: truck._id,
    truckNumber: truck.truckNumber,
    truckType: truck.truckType,
  });

  // Log the truck creation event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.CREATED,
    description: `New truck ${truck.truckNumber} created`,
    performedBy: req.user._id,
    metadata: {
      truckNumber: truck.truckNumber,
      truckType: truck.truckType,
    },
  });

  res.status(201).json({
    success: true,
    data: truck,
  });
});

// @desc    Update a truck
// @route   PUT /api/trucks/:id
// @access  Private
exports.updateTruck = BigPromise(async (req, res, next) => {
  let truck = await Truck.findById(req.params.id);

  if (!truck) {
    return next(
      new CustomError(`Truck not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user owns the truck
  if (truck.truckOwner.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this truck", 401));
  }

  // Ensure truckLocation contains placeName and coordinates, if provided
  if (req.body.truckLocation) {
    const { truckLocation } = req.body;
    if (
      !truckLocation.placeName ||
      !truckLocation.coordinates ||
      !truckLocation.coordinates.latitude ||
      !truckLocation.coordinates.longitude
    ) {
      return next(
        new CustomError(
          "Please provide a valid truck location with place name and coordinates",
          400
        )
      );
    }
  }

  // Prevent changing truck owner
  delete req.body.truckOwner;

  // Check for unique truck number if being updated
  if (req.body.truckNumber) {
    const existingTruck = await Truck.findOne({
      truckNumber: req.body.truckNumber,
      _id: { $ne: req.params.id },
    });
    if (existingTruck) {
      return next(new CustomError("Truck number must be unique", 400));
    }
  }

  // Track changes
  const changes = {};
  Object.keys(req.body).forEach((key) => {
    if (truck[key] !== req.body[key]) {
      changes[key] = {
        from: truck[key],
        to: req.body[key],
      };
    }
  });

  // Update truck
  truck = await Truck.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Log user activity
  const user = await User.findById(req.user.id);
  await user.logActivity("TRUCK_UPDATED", {
    truckId: truck._id,
    truckNumber: truck.truckNumber,
    changes,
  });

  // Log the update event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.UPDATED,
    description: `Truck ${truck.truckNumber} updated`,
    performedBy: req.user._id,
    changes,
  });

  res.status(200).json({
    success: true,
    data: truck,
  });
});

// @desc    Get all trucks for a user
// @route   GET /api/trucks
// @access  Private
exports.getUserTrucks = BigPromise(async (req, res, next) => {
  const trucks = await Truck.find({ truckOwner: req.user.id }).select(
    "-RCImage"
  );

  res.status(200).json({
    success: true,
    count: trucks.length,
    data: trucks,
  });
});

// @desc    Get a single truck
// @route   GET /api/trucks/:id
// @access  Private
exports.getTruck = BigPromise(async (req, res, next) => {
  // Dont send rcImage

  const truck = await Truck.findById(req.params.id).select("-RCImage");

  if (!truck) {
    return next(
      new CustomError(`Truck not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user owns the truck
  if (truck.truckOwner.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to access this truck", 401));
  }

  res.status(200).json({
    success: true,
    data: truck,
  });
});

// @desc    Delete a truck
// @route   DELETE /api/trucks/:id
// @access  Private
exports.deleteTruck = BigPromise(async (req, res, next) => {
  const truck = await Truck.findById(req.params.id);

  if (!truck) {
    return next(
      new CustomError(`Truck not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user owns the truck
  if (truck.truckOwner.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to delete this truck", 401));
  }

  // Log the deletion event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.DELETED,
    description: `Truck ${truck.truckNumber} deleted`,
    performedBy: req.user._id,
    metadata: {
      truckNumber: truck.truckNumber,
      truckType: truck.truckType,
    },
  });

  await truck.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Verify truck RC
// @route   PUT /api/trucks/:id/verify
// @access  Admin
exports.verifyTruckRC = BigPromise(async (req, res, next) => {
  const { status } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return next(new CustomError("Invalid verification status", 400));
  }

  const truck = await Truck.findByIdAndUpdate(
    req.params.id,
    {
      RCVerificationStatus: status,
      isRCVerified: status === "APPROVED",
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!truck) {
    return next(
      new CustomError(`Truck not found with id of ${req.params.id}`, 404)
    );
  }

  // Log the RC verification event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.RC_VERIFIED,
    description: `RC verification ${status.toLowerCase()} for truck ${
      truck.truckNumber
    }`,
    performedBy: req.user._id,
    metadata: {
      status,
      truckNumber: truck.truckNumber,
    },
  });

  res.status(200).json({
    success: true,
    data: truck,
  });
});

exports.getNearbyTrucks = BigPromise(async (req, res, next) => {
  // Destructure query parameters with defaults
  const {
    latitude,
    longitude,
    radius = 100, // Default to 100km
    truckBodyType,
    truckType,
    vehicleBodyType,
    page = 1,
    limit = 20,
  } = req.query;

  // Validate required parameters
  if (!latitude || !longitude) {
    return next(
      new CustomError(
        "Please provide both latitude and longitude coordinates",
        400
      )
    );
  }

  // Convert and validate coordinates
  const coordinates = {
    lat: parseFloat(latitude),
    lng: parseFloat(longitude),
    rad: parseFloat(radius),
  };

  // Validate coordinate values
  if (Object.values(coordinates).some(isNaN)) {
    return next(
      new CustomError(
        "Invalid coordinate values. Please provide valid numbers",
        400
      )
    );
  }

  // Validate coordinate ranges
  if (coordinates.lat < -90 || coordinates.lat > 90) {
    return next(
      new CustomError("Latitude must be between -90 and 90 degrees", 400)
    );
  }

  if (coordinates.lng < -180 || coordinates.lng > 180) {
    return next(
      new CustomError("Longitude must be between -180 and 180 degrees", 400)
    );
  }

  if (coordinates.rad <= 0) {
    return next(new CustomError("Radius must be greater than 0", 400));
  }

  try {
    const radiusInRadians = coordinates.rad / 6371;

    // Build query with active trucks only
    const query = {
      truckLocation: {
        $geoWithin: {
          $centerSphere: [[coordinates.lng, coordinates.lat], radiusInRadians],
        },
      },
      expiresAt: { $gt: new Date() }, // Only show non-expired trucks
    };

    // Add optional filters if provided
    const filters = {
      truckBodyType,
      truckType,
      vehicleBodyType,
    };

    // Add valid filters to query
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query[key] = value;
    });

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [trucks, total] = await Promise.all([
      Truck.find(query)
        .populate("truckOwner", "name phoneNumber userType")
        .select("-bids -rating -RCImage") // Exclude heavy arrays
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Convert to plain objects for better performance
      Truck.countDocuments(query),
    ]);

    // Add distance to response
    const trucksWithDistance = trucks
      .map((truck) => {
        const [lng, lat] = truck.truckLocation.coordinates;
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          lat,
          lng
        );
        return {
          ...truck,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    // Log the search activity if user is authenticated
    if (req.user) {
      await req.user.logActivity("TRUCK_SEARCHED", {
        location: {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          radius: coordinates.rad,
        },
        filters: {
          truckBodyType,
          truckType,
          vehicleBodyType,
        },
        resultsCount: total,
      });

      // Log the search event
      await EventLogger.log({
        entityType: "TRUCK",
        entityId: req.user._id,
        event: EventLogger.EVENTS.TRUCK.SEARCHED,
        description: `User searched for trucks`,
        performedBy: req.user._id,
        metadata: {
          location: {
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            radius: coordinates.rad,
          },
          filters: {
            truckBodyType,
            truckType,
            vehicleBodyType,
          },
          resultsCount: total,
        },
      });
    } else {
      console.log("user missing");
    }

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: trucksWithDistance,
      location: {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        radius: coordinates.rad,
      },
    });
  } catch (error) {
    return next(
      new CustomError(
        error.message || "Error while fetching nearby trucks",
        500
      )
    );
  }
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

exports.repostTruck = BigPromise(async (req, res, next) => {
  const { truckId, truckLocation } = req.body;

  // Validate location data if provided
  if (truckLocation) {
    if (
      !truckLocation.placeName ||
      !truckLocation.coordinates ||
      !truckLocation.coordinates.latitude ||
      !truckLocation.coordinates.longitude
    ) {
      return next(
        new CustomError(
          "Please provide valid location data with place name and coordinates",
          400
        )
      );
    }
  }

  let truck = await Truck.findById(truckId);

  if (!truck) {
    return next(new CustomError(`Truck not found with id of ${truckId}`, 404));
  }

  // Ensure the user owns the truck
  if (truck.truckOwner.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this truck", 401));
  }

  // Update truck with new location if provided
  const updateData = {
    totalBids: 20,
    expiresAt: new Date(+new Date() + 1 * 12 * 60 * 60 * 1000),
  };

  if (truckLocation) {
    // Format coordinates for GeoJSON with required type field
    updateData.truckLocation = {
      type: "Point",
      placeName: truckLocation.placeName,
      coordinates: [
        parseFloat(truckLocation.coordinates.longitude),
        parseFloat(truckLocation.coordinates.latitude),
      ],
    };
  }

  // Update truck
  truck = await Truck.findByIdAndUpdate(truckId, updateData, {
    new: true,
    runValidators: true,
  });

  // Log the repost event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.REPOSTED,
    description: `Truck ${truck.truckNumber} reposted`,
    performedBy: req.user._id,
    metadata: {
      truckNumber: truck.truckNumber,
      newExpiryDate: truck.expiresAt,
      newLocation: truckLocation ? truckLocation.placeName : undefined,
    },
  });

  res.status(200).json({
    success: true,
    message: "reposted successfully",
    data: truck,
  });
});

exports.pauseTruck = BigPromise(async (req, res, next) => {
  const { truckId } = req.body;
  let truck = await Truck.findById(truckId);

  if (!truck) {
    return next(new CustomError(`Truck not found with id of ${truckId}`, 404));
  }

  // Ensure the user owns the truck
  if (truck.truckOwner.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this truck", 401));
  }
  // Update truck
  console.log(new Date());
  truck = await Truck.findByIdAndUpdate(
    truckId,
    {
      ...req.body,
      totalBids: 20,
      expiresAt: new Date(),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // Log the pause event
  await EventLogger.log({
    entityType: "TRUCK",
    entityId: truck._id,
    event: EventLogger.EVENTS.TRUCK.PAUSED,
    description: `Truck ${truck.truckNumber} paused`,
    performedBy: req.user._id,
    metadata: {
      truckNumber: truck.truckNumber,
      pausedAt: truck.expiresAt,
    },
  });

  res.status(200).json({
    success: true,
    message: "reposted successfully",
  });
});
