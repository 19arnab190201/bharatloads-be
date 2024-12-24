const LoadPost = require("../models/loadPost");
const BigPromise = require("../middleware/BigPromise");
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
  } = req.body;

  // Ensure all required fields are present
  if (
    !materialType ||
    !source ||
    !destination ||
    !vehicleType ||
    !vehicleBodyType ||
    !offeredAmount
  ) {
    return next(
      new CustomError("Please provide all required load post details", 400)
    );
  }

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
  const loadPost = await LoadPost.findById(req.params.id).populate("bids"); // Populate bids with details

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