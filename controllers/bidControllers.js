const Bid = require("../models/bid");
const LoadPost = require("../models/loadPost");
const Truck = require("../models/truck");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");

// @desc    Create a new bid on truck by transporter
// @route   POST /api/bids
// @access  Private
//Create a new bid for a transport request
exports.createBidForTransporter = BigPromise(async (req, res, next) => {
  const { loadId, offeredAmount, bidType, truckId } = req.body;

  // Validate required fields for LOAD_BID type
  if (bidType === "LOAD_BID") {
    // Handle case when loadId is not provided (create new load post)
    if (!loadId) {
      const {
        transporterId,
        vehicleBodyType,
        vehicleType,
        numberOfWheels,
        whenNeeded,
        materialType,
        weight,
        source,
        destination,
      } = req.body;

      // Ensure all required fields for creating a load post are present
      if (
        !vehicleBodyType ||
        !vehicleType ||
        !numberOfWheels ||
        !whenNeeded ||
        !offeredAmount ||
        !materialType ||
        !weight ||
        !source ||
        !destination
      ) {
        return next(
          new CustomError("Please provide all required load post details", 400)
        );
      }

      // Create a new load post
      const loadPost = await LoadPost.create({
        transporterId: req.user._id,
        materialType,
        weight,
        source,
        destination,
        vehicleBodyType,
        vehicleType,
        numberOfWheels,
        offeredAmount,
        whenNeeded,
      });

      // Create a bid for the newly created load post
      const bid = await Bid.create({
        bidType,
        bidBy: req.user._id,
        loadId: loadPost._id,
        truckId,
        materialType,
        weight,
        offeredAmount,
        source,
        destination,
      });
      // add this bid to truck's bid array
      await Truck.findByIdAndUpdate(truckId, {
        $push: { bids: bid._id },
      });

      return res.status(201).json({ success: true, bid });
    }

    // Handle case when loadId is provided (use existing load post)
    const loadPost = await LoadPost.findById(loadId);

    if (!loadPost) {
      return next(new CustomError("Load post not found", 404));
    }

    // Create a bid for the existing load post
    const bid = await Bid.create({
      bidType,
      bidBy: req.user._id,
      loadId,
      truckId,
      materialType: loadPost.materialType,
      weight: loadPost.weight,
      offeredAmount: loadPost.offeredAmount,
      source: loadPost.source,
      destination: loadPost.destination,
    });
    await Truck.findByIdAndUpdate(truckId, {
      $push: { bids: bid._id },
    });
    return res.status(201).json({ success: true, bid });
  }

  // If bidType is not LOAD_BID, handle accordingly (optional)
  return next(new CustomError("Invalid bid type", 400));
});

// @desc    Create a new bid on load by trucker
// @route   POST /api/bids
// @access  Private
//Create a new bid for a trucker request
exports.createBidForTrucker = BigPromise(async (req, res, next) => {
  const { loadId, offeredAmount, bidType, truckId } = req.body;

  // Validate required fields for TRUCK_REQUEST type

  if (bidType === "TRUCK_REQUEST") {
    // Handle case when loadId is not provided (create new load post)
    if (!loadId) {
      // Create a bid for the newly created load post
      const bid = await Bid.create({
        bidType,
        bidBy: req.user._id,
        loadId: loadPost._id,
        truckId,
        materialType,
        weight,
        offeredAmount,
        source,
        destination,
      });
      // add this bid to load's bid array
      await LoadPost.findByIdAndUpdate(loadId, {
        $push: { bids: bid._id },
      });

      return res.status(201).json({ success: true, bid });
    }

    // Handle case when loadId is provided (use existing load post)
    const loadPost = await LoadPost.findById(loadId);

    if (!loadPost) {
      return next(new CustomError("Load post not found", 404));
    }

    const bidPayload = {
      bidType,
      bidBy: req.user._id,
      loadId,
      truckId,
      materialType: loadPost.materialType,
      weight: loadPost.weight,
      offeredAmount: loadPost.offeredAmount,
      source: loadPost.source,
      destination: loadPost.destination,
    };

    console.log("amt", loadPost.offeredAmount);

    console.log("loadPost", loadPost);

    console.log("bidPayload", bidPayload);

    // Create a bid for the existing load post
    const bid = await Bid.create(bidPayload);
    await LoadPost.findByIdAndUpdate(loadId, {
      $push: { bids: bid._id },
    });
    return res.status(201).json({ success: true, bid });
  }

  // If bidType is not Truck, handle accordingly (optional)

  return next(new CustomError("Invalid bid type", 400));
});

// @desc    Get all bids for a user
// @route   GET /api/bids
// @access  Private
exports.getUserBids = BigPromise(async (req, res, next) => {
  console.log("req.user", req.user);
  const bids = await Bid.find({ bidBy: req.user._id })
    .populate("loadId")
    .populate("truckId");

  res.status(200).json({
    success: true,
    count: bids.length,
    data: bids,
  });
});

// @desc    Get a single bid
// @route   GET /api/bids/:id
// @access  Private
exports.getBid = BigPromise(async (req, res, next) => {
  const bid = await Bid.findById(req.params.id)
    .populate("loadId")
    .populate("truckId");

  if (!bid) {
    return next(
      new CustomError(`Bid not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the trucker or the load post owner
  if (bid.truckerId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to access this bid", 401));
  }

  res.status(200).json({
    success: true,
    data: bid,
  });
});

// @desc    Update a bid
// @route   PUT /api/bids/:id
// @access  Private
exports.updateBid = BigPromise(async (req, res, next) => {
  let bid = await Bid.findById(req.params.id);

  if (!bid) {
    return next(
      new CustomError(`Bid not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the trucker
  if (bid.truckerId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update this bid", 401));
  }

  // Prevent changing certain fields
  delete req.body.truckerId;
  delete req.body.loadId;
  delete req.body.status;

  // Update bid
  bid = await Bid.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: bid,
  });
});

// @desc    Delete a bid
// @route   DELETE /api/bids/:id
// @access  Private
exports.deleteBid = BigPromise(async (req, res, next) => {
  const bid = await Bid.findById(req.params.id);

  if (!bid) {
    return next(
      new CustomError(`Bid not found with id of ${req.params.id}`, 404)
    );
  }

  // Ensure the user is the trucker
  if (bid.truckerId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to delete this bid", 401));
  }

  // Remove bid from load post's bids array
  await LoadPost.findByIdAndUpdate(bid.loadId, {
    $pull: { bids: bid._id },
  });

  await bid.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Accept or Reject a bid
// @route   PUT /api/bids/:id/status
// @access  Private (Load Post Owner)
exports.updateBidStatus = BigPromise(async (req, res, next) => {
  const { status } = req.body;

  // Validate status
  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    return next(new CustomError("Invalid bid status", 400));
  }

  const bid = await Bid.findById(req.params.id);

  if (!bid) {
    return next(
      new CustomError(`Bid not found with id of ${req.params.id}`, 404)
    );
  }

  // Verify the load post and ensure the current user is the load post owner
  const loadPost = await LoadPost.findById(bid.loadId);
  if (!loadPost || loadPost.transporterId.toString() !== req.user.id) {
    return next(new CustomError("Not authorized to update bid status", 401));
  }

  // Update bid status
  bid.status = status;
  await bid.save();

  res.status(200).json({
    success: true,
    data: bid,
  });
});

// @desc    Get bids for a specific load post
// @route   GET /api/loads/:loadId/bids
// @access  Private (Load Post Owner)
exports.getLoadBids = BigPromise(async (req, res, next) => {
  // Find the load post first to ensure the user has access
  const loadPost = await LoadPost.findById(req.params.loadId);

  if (!loadPost) {
    return next(
      new ErrorResponse(
        `Load post not found with id of ${req.params.loadId}`,
        404
      )
    );
  }

  // Ensure the user is the load post owner
  if (loadPost.transporterId.toString() !== req.user.id) {
    return next(
      new ErrorResponse("Not authorized to view bids for this load post", 401)
    );
  }

  // Find bids for this load post
  const bids = await Bid.find({ loadId: req.params.loadId })
    .populate("truckerId", "name email phone") // Populate trucker details
    .populate("truckId"); // Populate truck details if available

  res.status(200).json({
    success: true,
    count: bids.length,
    data: bids,
  });
});

// @desc    Filter and search bids
// @route   GET /api/bids/search
// @access  Private
exports.searchBids = BigPromise(async (req, res, next) => {
  const {
    status,
    bidType,
    minAmount,
    maxAmount,
    materialType,
    source,
    destination,
  } = req.query;

  // Build query object
  const query = { truckerId: req.user.id };

  // Add optional filters
  if (status) query.status = status;
  if (bidType) query.bidType = bidType;

  if (minAmount || maxAmount) {
    query.offeredAmount = {};
    if (minAmount) query.offeredAmount.$gte = parseFloat(minAmount);
    if (maxAmount) query.offeredAmount.$lte = parseFloat(maxAmount);
  }

  if (materialType) query.materialType = materialType;
  if (source) query.source = { $regex: source, $options: "i" };
  if (destination) query.destination = { $regex: destination, $options: "i" };

  // Perform search
  const bids = await Bid.find(query)
    .populate("loadId")
    .populate("truckId")
    .sort({ createdAt: -1 }); // Sort by most recent first

  res.status(200).json({
    success: true,
    count: bids.length,
    data: bids,
  });
});

// @desc    Get bid statistics
// @route   GET /api/bids/stats
// @access  Private
exports.getBidStatistics = BigPromise(async (req, res, next) => {
  const statistics = await Bid.aggregate([
    // Match bids for the current user
    { $match: { truckerId: req.user._id } },

    // Group to calculate statistics
    {
      $group: {
        _id: {
          status: "$status",
          bidType: "$bidType",
        },
        totalBids: { $sum: 1 },
        totalAmount: { $sum: "$offeredAmount" },
        avgAmount: { $avg: "$offeredAmount" },
      },
    },

    // Reshape the output
    {
      $project: {
        _id: 0,
        status: "$_id.status",
        bidType: "$_id.bidType",
        totalBids: 1,
        totalAmount: 1,
        averageAmount: { $round: ["$avgAmount", 2] },
      },
    },

    // Sort by total bids
    { $sort: { totalBids: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: statistics,
  });
});
