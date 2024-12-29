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
    return next(new CustomError("Please provide all required truck details", 400));
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