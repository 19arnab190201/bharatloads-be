const Truck = require("../models/truck");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");

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
  console.log(truckLocation);
  if (
    !truckLocation ||
    !truckLocation.placeName ||
    !truckLocation.coordinates ||
    !Array.isArray(truckLocation.coordinates.coordinates) ||
    truckLocation.coordinates.coordinates.length !== 2
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

  // Validate truck number uniqueness
  const existingTruck = await Truck.findOne({
    truckNumber: req.body.truckNumber,
  });
  if (existingTruck) {
    return next(new CustomError("Truck number must be unique", 400));
  }

  // Create the truck
  const truck = await Truck.create(req.body);

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

  // Update truck
  truck = await Truck.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
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
  const trucks = await Truck.find({ truckOwner: req.user.id });

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
  const truck = await Truck.findById(req.params.id);

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
    radius = 50,
    truckBodyType,
    truckType,
    vehicleBodyType,
    page = 1,
    limit = 10,
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
    // Convert radius to radians (required for $centerSphere)
    const radiusInRadians = coordinates.rad / 6371; // 6371 is Earth's radius in kilometers

    // Build base query using $geoWithin and $centerSphere
    const query = {
      truckLocation: {
        $geoWithin: {
          $centerSphere: [[coordinates.lng, coordinates.lat], radiusInRadians],
        },
      },
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
        .select("-bids -rating") // Exclude heavy arrays
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Convert to plain objects for better performance
      Truck.countDocuments(query),
    ]);

    // Calculate distances for each truck and sort by distance
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
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
        };
      })
      .sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: trucksWithDistance,
      filters: {
        ...filters,
        radius: coordinates.rad,
        coordinates: [coordinates.lat, coordinates.lng],
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
