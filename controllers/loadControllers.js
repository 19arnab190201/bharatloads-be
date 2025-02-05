const LoadPost = require("../models/loadPost");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");
const EventLogger = require("../utils/eventLogger");

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
    scheduleDate,
    scheduleTime,
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
    coordinates: [source.coordinates[1], source.coordinates[0]],
  };

  req.body.destination = {
    placeName: destination.placeName,
    coordinates: [destination.coordinates[1], destination.coordinates[0]],
  };

  // Handle scheduling
  if (req.body.whenNeeded === "SCHEDULED") {
    const scheduleDateTime = new Date(
      `${req.body.scheduleDate}T${req.body.scheduleTime}`
    );

    if (scheduleDateTime <= new Date()) {
      return next(new CustomError("Schedule time must be in the future", 400));
    }

    req.body.scheduleDate = scheduleDateTime;
  }

  // Create the load post
  const loadPost = await LoadPost.create(req.body);

  // If it's a scheduled post, create a job to activate it at the scheduled time
  if (loadPost.whenNeeded === "SCHEDULED") {
    const activationDelay =
      new Date(loadPost.scheduleDate).getTime() - Date.now();

    setTimeout(async () => {
      try {
        await LoadPost.findByIdAndUpdate(loadPost._id, { isActive: true });
      } catch (error) {
        console.error("Error activating scheduled load:", error);
      }
    }, activationDelay);
  }

  // Log the load creation event
  await EventLogger.log({
    entityType: "LOAD_POST",
    entityId: loadPost._id,
    event: EventLogger.EVENTS.LOAD.CREATED,
    description: `New load post created for ${loadPost.materialType}`,
    performedBy: req.user._id,
    metadata: {
      materialType: loadPost.materialType,
      weight: loadPost.weight,
      source: loadPost.source.placeName,
      destination: loadPost.destination.placeName,
      offeredAmount: loadPost.offeredAmount,
    },
  });

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
  }).populate("bids");

  // Add an isActive flag in the response for frontend display
  const loadsWithStatus = loadPosts.map((load) => {
    const loadObj = load.toObject();
    loadObj.isActive = load.isActive;
    if (load.whenNeeded === "SCHEDULED") {
      loadObj.isActive =
        load.isActive && new Date(load.scheduleDate) <= new Date();
    }
    return loadObj;
  });

  res.status(200).json({
    success: true,
    count: loadsWithStatus.length,
    data: loadsWithStatus,
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

  // Track changes
  const changes = {};
  Object.keys(req.body).forEach((key) => {
    if (loadPost[key] !== req.body[key]) {
      changes[key] = {
        from: loadPost[key],
        to: req.body[key],
      };
    }
  });

  // Update load post
  loadPost = await LoadPost.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Log the update event
  await EventLogger.log({
    entityType: "LOAD_POST",
    entityId: loadPost._id,
    event: EventLogger.EVENTS.LOAD.UPDATED,
    description: `Load post updated for ${loadPost.materialType}`,
    performedBy: req.user._id,
    changes,
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

  // Log the deletion event
  await EventLogger.log({
    entityType: "LOAD_POST",
    entityId: loadPost._id,
    event: EventLogger.EVENTS.LOAD.DELETED,
    description: `Load post deleted for ${loadPost.materialType}`,
    performedBy: req.user._id,
    metadata: {
      materialType: loadPost.materialType,
      weight: loadPost.weight,
      source: loadPost.source.placeName,
      destination: loadPost.destination.placeName,
    },
  });

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
  const loadPosts = await LoadPost.find({
    expiresAt: { $gt: new Date() },
    $or: [
      { transporterId: req.user.id }, // Show all user's own loads
      {
        $and: [
          { isActive: true }, // Only show active loads for others
          {
            $or: [
              { whenNeeded: "IMMEDIATE" },
              {
                whenNeeded: "SCHEDULED",
                scheduleDate: { $lte: new Date() },
              },
            ],
          },
        ],
      },
    ],
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
    sourceLatitude,
    sourceLongitude,
    destinationLatitude,
    destinationLongitude,
    radius = 100, // Default to 100km
    materialType,
    vehicleType,
    vehicleBodyType,
    page = 1,
    limit = 20,
  } = req.query;

  // Convert and validate coordinates if provided
  let sourceCoords = null;
  let destCoords = null;

  if (sourceLatitude && sourceLongitude) {
    sourceCoords = {
      lng: parseFloat(sourceLatitude),
      lat: parseFloat(sourceLongitude),
      rad: parseFloat(radius),
    };

    // Validate source coordinate values
    if (Object.values(sourceCoords).some(isNaN)) {
      return next(
        new CustomError(
          "Invalid source coordinate values. Please provide valid numbers",
          400
        )
      );
    }

    if (sourceCoords.lat < -90 || sourceCoords.lat > 90) {
      return next(
        new CustomError(
          "Source latitude must be between -90 and 90 degrees",
          400
        )
      );
    }

    if (sourceCoords.lng < -180 || sourceCoords.lng > 180) {
      return next(
        new CustomError(
          "Source longitude must be between -180 and 180 degrees",
          400
        )
      );
    }
  }

  if (destinationLatitude && destinationLongitude) {
    destCoords = {
      lng: parseFloat(destinationLatitude),
      lat: parseFloat(destinationLongitude),
      rad: parseFloat(radius),
    };

    // Validate destination coordinate values
    if (Object.values(destCoords).some(isNaN)) {
      return next(
        new CustomError(
          "Invalid destination coordinate values. Please provide valid numbers",
          400
        )
      );
    }

    if (destCoords.lat < -90 || destCoords.lat > 90) {
      return next(
        new CustomError(
          "Destination latitude must be between -90 and 90 degrees",
          400
        )
      );
    }

    if (destCoords.lng < -180 || destCoords.lng > 180) {
      return next(
        new CustomError(
          "Destination longitude must be between -180 and 180 degrees",
          400
        )
      );
    }
  }

  try {
    const radiusInRadians = parseFloat(radius) / 6371;

    // Add isActive filter to baseQuery
    const baseQuery = {
      expiresAt: { $gt: new Date() },
      $or: [
        { transporterId: req.user?._id }, // Always show user's own loads
        {
          $and: [
            { isActive: true }, // Only show active loads for others
            {
              $or: [
                { whenNeeded: "IMMEDIATE" },
                {
                  whenNeeded: "SCHEDULED",
                  scheduleDate: { $lte: new Date() },
                },
              ],
            },
          ],
        },
      ],
    };

    // Add optional filters if provided
    const filters = {
      materialType,
      vehicleType,
      vehicleBodyType,
    };

    // Add valid filters to query
    Object.entries(filters).forEach(([key, value]) => {
      if (value) baseQuery[key] = value;
    });

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Prepare source and destination queries
    let sourceLoads = [];
    let destLoads = [];
    let bothMatchLoads = [];

    // If source coordinates provided, find loads with matching source
    if (sourceCoords) {
      const sourceQuery = {
        ...baseQuery,
        "source.coordinates": {
          $geoWithin: {
            $centerSphere: [
              [sourceCoords.lng, sourceCoords.lat],
              radiusInRadians,
            ],
          },
        },
      };

      sourceLoads = await LoadPost.find(sourceQuery).select("-bids").lean();
    }

    // If destination coordinates provided, find loads with matching destination
    if (destCoords) {
      const destQuery = {
        ...baseQuery,
        "destination.coordinates": {
          $geoWithin: {
            $centerSphere: [[destCoords.lng, destCoords.lat], radiusInRadians],
          },
        },
      };

      destLoads = await LoadPost.find(destQuery).select("-bids").lean();
    }

    // If both coordinates provided, find loads matching both
    if (sourceCoords && destCoords) {
      const bothQuery = {
        ...baseQuery,
        "source.coordinates": {
          $geoWithin: {
            $centerSphere: [
              [sourceCoords.lng, sourceCoords.lat],
              radiusInRadians,
            ],
          },
        },
        "destination.coordinates": {
          $geoWithin: {
            $centerSphere: [[destCoords.lng, destCoords.lat], radiusInRadians],
          },
        },
      };

      bothMatchLoads = await LoadPost.find(bothQuery).select("-bids").lean();
    }

    // Create sets to handle duplicates
    const bothMatchSet = new Set(
      bothMatchLoads.map((load) => load._id.toString())
    );
    const sourceSet = new Set(sourceLoads.map((load) => load._id.toString()));
    const destSet = new Set(destLoads.map((load) => load._id.toString()));

    // Filter out loads that are in bothMatchSet from source and dest loads
    sourceLoads = sourceLoads.filter(
      (load) => !bothMatchSet.has(load._id.toString())
    );
    destLoads = destLoads.filter(
      (load) => !bothMatchSet.has(load._id.toString())
    );

    // Combine all loads with priority order
    const allLoads = [...bothMatchLoads, ...sourceLoads, ...destLoads];

    // Add distance calculations
    const loadsWithDistance = allLoads.map((load) => {
      const distances = {};

      if (sourceCoords) {
        distances.sourceDistance = calculateDistance(
          sourceCoords.lat,
          sourceCoords.lng,
          load.source.coordinates[1],
          load.source.coordinates[0]
        );
      }

      if (destCoords) {
        distances.destinationDistance = calculateDistance(
          destCoords.lat,
          destCoords.lng,
          load.destination.coordinates[1],
          load.destination.coordinates[0]
        );
      }

      return {
        ...load,
        matchType: bothMatchSet.has(load._id.toString())
          ? "BOTH"
          : sourceSet.has(load._id.toString())
          ? "SOURCE"
          : "DESTINATION",
        distances,
      };
    });

    // Paginate results
    const paginatedLoads = loadsWithDistance.slice(
      skip,
      skip + parseInt(limit)
    );

    res.status(200).json({
      success: true,
      count: allLoads.length,
      pages: Math.ceil(allLoads.length / limit),
      currentPage: parseInt(page),
      data: paginatedLoads,
      searchCriteria: {
        source: sourceCoords,
        destination: destCoords,
        radius,
      },
    });
  } catch (error) {
    return next(
      new CustomError(error.message || "Error while fetching nearby loads", 500)
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
    return next(new CustomError(`Load not found with id of ${loadId}`, 404));
  }

  // Ensure the user owns the load
  if (load.transporterId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this load", 401));
  }

  // Update load
  load = await LoadPost.findByIdAndUpdate(
    loadId,
    {
      ...req.body,
      bids: [],
      expiresAt: new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // Log the repost event
  await EventLogger.log({
    entityType: "LOAD_POST",
    entityId: load._id,
    event: EventLogger.EVENTS.LOAD.REPOSTED,
    description: `Load post reposted for ${load.materialType}`,
    performedBy: req.user._id,
    metadata: {
      materialType: load.materialType,
      weight: load.weight,
      newExpiryDate: load.expiresAt,
    },
  });

  res.status(200).json({
    success: true,
    message: "Load reposted successfully",
  });
});

exports.pauseLoad = BigPromise(async (req, res, next) => {
  const { loadId } = req.body;
  let load = await LoadPost.findById(loadId);

  if (!load) {
    return next(new CustomError(`Load not found with id of ${loadId}`, 404));
  }

  // Ensure the user owns the load
  if (load.transporterId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this load", 401));
  }

  // Update load
  load = await LoadPost.findByIdAndUpdate(
    loadId,
    {
      ...req.body,
      expiresAt: new Date(), // Expire immediately
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // Log the pause event
  await EventLogger.log({
    entityType: "LOAD_POST",
    entityId: load._id,
    event: EventLogger.EVENTS.LOAD.PAUSED,
    description: `Load post paused for ${load.materialType}`,
    performedBy: req.user._id,
    metadata: {
      materialType: load.materialType,
      weight: load.weight,
      pausedAt: load.expiresAt,
    },
  });

  res.status(200).json({
    success: true,
    message: "Load paused successfully",
  });
});
