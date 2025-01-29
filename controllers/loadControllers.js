const LoadPost = require("../models/loadPost");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");

// @desc    Create a new load post
// @route   POST /api/loads
// @access  Private
exports.createLoadPost = BigPromise(async (req, res, next) => {
  // Add the logged-in user's ID as transporter
  req.body.transporterId = req.user.id;

  // Validate required fields
  const {
    materialType,
    source,
    destination,
    vehicleType,
    vehicleBodyType,
    offeredAmount,
    whenNeeded,
    numberOfWheels,
  } = req.body;

  // Ensure source and destination include place name and coordinates
  if (
    !materialType ||
    !source?.placeName ||
    !destination?.placeName ||
    !vehicleType ||
    !vehicleBodyType ||
    !offeredAmount ||
    !whenNeeded ||
    !numberOfWheels
  ) {
    return next(
      new CustomError(
        "Please provide all required details including source and destination with coordinates",
        400
      )
    );
  }

  // Capitalize material type
  req.body.materialType = materialType.toUpperCase();

  req.body.source = {
    placeName: source.placeName,
    coordinates: [source.coordinates[1], source.coordinates[0]]
  };

  req.body.destination = {
    placeName: destination.placeName,
    coordinates: [destination.coordinates[1], destination.coordinates[0]]
  };

  // Create the load post
  const loadPost = await LoadPost.create(req.body);

  res.status(201).json({
    success: true,
    data: loadPost,
  });
});

// @desc    Get all load posts for a user
// @route   GET /api/loads
// @access  Private
exports.getUserLoadPosts = BigPromise(async (req, res, next) => {
  const loadPosts = await LoadPost.find({
    transporterId: req.user.id,
  }).populate("bids"); // Optionally populate bids

  res.status(200).json({
    success: true,
    count: loadPosts.length,
    data: loadPosts,
  });
});

// @desc    Get a single load post
// @route   GET /api/loads/:id
// @access  Private
exports.getLoadPost = BigPromise(async (req, res, next) => {
  const loadPost = await LoadPost.findById(req.params.id);

  if (!loadPost) {
    return next(
      new CustomError(`Load post not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the transporter or has access
  if (loadPost.transporterId.toString() !== req.user.id) {
    return next(
      new CustomError("Not authorized to access this load post", 401)
    );
  }

  res.status(200).json({
    success: true,
    data: loadPost,
  });
});

// @desc    Update a load post
// @route   PUT /api/loads/:id
// @access  Private
exports.updateLoadPost = BigPromise(async (req, res, next) => {
  let loadPost = await LoadPost.findById(req.params.id);

  if (!loadPost) {
    return next(
      new CustomError(`Load post not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the transporter
  if (loadPost.transporterId.toString() !== req.user.id) {
    return next(
      new CustomError("Not authorized to update this load post", 401)
    );
  }

  // Prevent changing transporter
  delete req.body.transporterId;

  // Ensure source and destination include place name and coordinates
  if (
    req.body.source &&
    (!req.body.source.placeName ||
      !req.body.source.coordinates?.latitude ||
      !req.body.source.coordinates?.longitude)
  ) {
    return next(
      new CustomError(
        "Please provide valid source details including place name and coordinates",
        400
      )
    );
  }

  if (
    req.body.destination &&
    (!req.body.destination.placeName ||
      !req.body.destination.coordinates?.latitude ||
      !req.body.destination.coordinates?.longitude)
  ) {
    return next(
      new CustomError(
        "Please provide valid destination details including place name and coordinates",
        400
      )
    );
  }

  // Update load post
  loadPost = await LoadPost.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: loadPost,
  });
});

// @desc    Delete a load post
// @route   DELETE /api/loads/:id
// @access  Private
exports.deleteLoadPost = BigPromise(async (req, res, next) => {
  const loadPost = await LoadPost.findById(req.params.id);

  if (!loadPost) {
    return next(
      new CustomError(`Load post not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the transporter
  if (loadPost.transporterId.toString() !== req.user.id) {
    return next(
      new CustomError("Not authorized to delete this load post", 401)
    );
  }

  await loadPost.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get active load posts
// @route   GET /api/loads/active
// @access  Private
exports.getActiveLoadPosts = BigPromise(async (req, res, next) => {
  // Filter for active load posts (you might want to add more sophisticated filtering)
  const loadPosts = await LoadPost.find({
    // Add any additional filtering conditions
    // For example, excluding load posts that are already fully booked
  }).populate("bids");

  res.status(200).json({
    success: true,
    count: loadPosts.length,
    data: loadPosts,
  });
});

// @desc    Get nearby load posts
// @route   GET /api/loads/nearby
// @access  Private
exports.getNearbyLoadPosts = BigPromise(async (req, res, next) => {
  // Destructure query parameters with defaults
  const {
    latitude,
    longitude,
    radius = 100, // Default to 100km
    materialType,
    vehicleType,
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

    // Build query with active loads only
    const query = {
      "source.coordinates": {
        $geoWithin: {
          $centerSphere: [[coordinates.lng, coordinates.lat], radiusInRadians],
        },
      },
      expiresAt: { $gt: new Date() } // Only show non-expired loads
    };

    // Add optional filters if provided
    const filters = {
      materialType,
      vehicleType,
      vehicleBodyType,
    };

    // Add valid filters to query
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query[key] = value;
    });

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [loads, total] = await Promise.all([
      LoadPost.find(query)
        .select("-bids") // Exclude heavy arrays
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Convert to plain objects for better performance
      LoadPost.countDocuments(query),
    ]);

    // Add distance to response
    const loadsWithDistance = loads
      .map((load) => {
        const [lng, lat] = load.source.coordinates;
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          lat,
          lng
        );
        return {
          ...load,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      count: total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: loadsWithDistance,
      location: {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        radius: coordinates.rad
      }
    });
  } catch (error) {
    return next(
      new CustomError(
        error.message || "Error while fetching nearby loads",
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

exports.repostLoad = BigPromise(async (req, res, next) => {
  const { loadId } = req.body;
  let load = await LoadPost.findById(loadId);

  if (!load) {
    return next(
      new CustomError(`Load not found with id of ${loadId}`, 404)
    );
  }

  // Ensure the user owns the load
  if (load.transporterId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this load", 401));
  }

  // Update load
  load = await LoadPost.findByIdAndUpdate(loadId, {
    ...req.body,
    bids: [],
    expiresAt: new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
  }, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Load reposted successfully"
  });
});

exports.pauseLoad = BigPromise(async (req, res, next) => {
  const { loadId } = req.body;
  let load = await LoadPost.findById(loadId);

  if (!load) {
    return next(
      new CustomError(`Load not found with id of ${loadId}`, 404)
    );
  }

  // Ensure the user owns the load
  if (load.transporterId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this load", 401));
  }

  // Update load
  load = await LoadPost.findByIdAndUpdate(loadId, {
    ...req.body,
    expiresAt: new Date(), // Expire immediately
  }, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Load paused successfully"
  });
});
