const Bid = require("../models/bid");
const LoadPost = require("../models/loadPost");
const User = require("../models/user");
const Truck = require("../models/truck");
const Chat = require("../models/chat");
const BigPromise = require("../middlewares/BigPromise");
const CustomError = require("../utils/CustomError");
const NotificationService = require("../utils/notificationService");
const EventLogger = require("../utils/eventLogger");

// @desc    Create a new bid on truck by transporter
// @route   POST /api/bids/transporter
// @access  Private
exports.createBidForTransporter = BigPromise(async (req, res, next) => {
  const { loadId, biddedAmount, bidType, truckId } = req.body;

  if (bidType !== "LOAD_BID") {
    return next(new CustomError("Invalid bid type", 400));
  }

  console.log("loadId", loadId);
  console.log("truckId", truckId);
  if (!loadId || !truckId || !biddedAmount) {
    return next(
      new CustomError("Please provide loadId, truckId and biddedAmount", 400)
    );
  }

  // Get truck to verify it exists and get owner details
  const truck = await Truck.findById(truckId).select("-RCImage");
  if (!truck) {
    return next(new CustomError("Truck not found", 404));
  }

  // Get load post to get load details
  const loadPost = await LoadPost.findById(loadId);
  if (!loadPost) {
    return next(new CustomError("Load post not found", 404));
  }

  const bidPayload = {
    bidType,
    bidBy: req.user._id,
    offeredTo: loadPost.transporterId, // Owner of truck
    loadId,
    truckId,
    materialType: loadPost.materialType,
    weight: loadPost.weight,
    biddedAmount: biddedAmount,
    offeredAmount: loadPost.offeredAmount,
    source: loadPost.source,
    destination: loadPost.destination,
  };

  // Create bid and update truck's bids array
  const bid = await Bid.create(bidPayload);
  await Truck.findByIdAndUpdate(truckId, {
    $push: { bids: bid._id },
  });

  // Log user activity
  await req.user.logActivity("BID_PLACED", {
    bidId: bid._id,
    loadId: bid.loadId,
    truckId: bid.truckId,
    biddedAmount: bid.biddedAmount,
  });

  // Log the bid creation event
  await EventLogger.log({
    entityType: "BID",
    entityId: bid._id,
    event: EventLogger.EVENTS.BID.CREATED,
    description: `New bid created for load ${loadPost._id}`,
    performedBy: req.user._id,
    metadata: {
      bidType: bid.bidType,
      biddedAmount: bid.biddedAmount,
      loadId: bid.loadId,
      truckId: bid.truckId,
    },
  });

  // Send notification to the load owner
  await NotificationService.sendBidPlacedNotification(bid, loadPost);

  return res.status(201).json({ success: true, bid });
});

// @desc    Create a new bid on load by trucker
// @route   POST /api/bids/truck
// @access  Private
exports.createBidForTrucker = BigPromise(async (req, res, next) => {
  const { loadId, biddedAmount, bidType, truckId } = req.body;

  if (bidType !== "TRUCK_REQUEST") {
    return next(new CustomError("Invalid bid type", 400));
  }

  if (!loadId || !truckId || !biddedAmount) {
    return next(
      new CustomError("Please provide loadId, truckId and biddedAmount", 400)
    );
  }

  // Get load post to verify it exists and get transporter details
  const loadPost = await LoadPost.findById(loadId);
  if (!loadPost) {
    return next(new CustomError("Load post not found", 404));
  }
  console.log("truckId", truckId);
  const truck = await Truck.findById(truckId);
  console.log("truckOwner", truck);

  const bidPayload = {
    bidType,
    bidBy: req.user._id,
    offeredTo: truck.truckOwner, // Owner of load post
    loadId,
    truckId,
    materialType: loadPost.materialType,
    weight: loadPost.weight,
    biddedAmount: biddedAmount,
    offeredAmount: loadPost.offeredAmount,
    source: loadPost.source,
    destination: loadPost.destination,
  };

  // Create bid and update load post's bids array
  const bid = await Bid.create(bidPayload);
  await LoadPost.findByIdAndUpdate(loadId, {
    $push: { bids: bid._id },
  });

  // Send notification to the truck owner
  await NotificationService.sendBidPlacedNotification(bid, loadPost);

  return res.status(201).json({ success: true, bid });
});

// @desc    Get all bids for a user
// @route   GET /api/bids
// @access  Private
exports.getUserBids = BigPromise(async (req, res, next) => {
  console.log("req.user", req.user);
  const bids = await Bid.find({ bidBy: req.user._id })
    .populate("loadId")
    .populate("truckId")
    .populate("offeredTo")
    .populate("bidBy");

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

  // Log user activity
  await req.user.logActivity("BID_UPDATED", {
    bidId: bid._id,
    loadId: bid.loadId,
    truckId: bid.truckId,
    biddedAmount: bid.biddedAmount,
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
  if (bid.bidBy.toString() !== req.user.id) {
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
  const { status, rejectionReason, rejectionNote } = req.body;

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

  // Update bid status and rejection details
  bid.status = status;
  if (status === "REJECTED") {
    bid.rejectionReason = rejectionReason;
    bid.rejectionNote = rejectionNote;
  }
  await bid.save();

  // Log the bid status update event
  await EventLogger.log({
    entityType: "BID",
    entityId: bid._id,
    event:
      status === "ACCEPTED"
        ? EventLogger.EVENTS.BID.ACCEPTED
        : EventLogger.EVENTS.BID.REJECTED,
    description: `Bid ${status.toLowerCase()} for load ${bid.loadId}`,
    performedBy: req.user._id,
    metadata: {
      status,
      loadId: bid.loadId,
      truckId: bid.truckId,
    },
  });

  // Only handle BlCoins updates here, no notifications
  if (status === "ACCEPTED") {
    const user = await User.findById(bid.bidBy);
    user.BlCoins += 100;
    await user.save();
  } else if (status === "REJECTED") {
    const user = await User.findById(bid.offeredTo);
    user.BlCoins -= 100;
    await user.save();
  }

  return res.status(200).json({
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
      new CustomError(
        `Load post not found with id of ${req.params.loadId}`,
        404
      )
    );
  }

  // Ensure the user is the load post owner
  if (loadPost.transporterId.toString() !== req.user.id) {
    return next(
      new CustomError("Not authorized to view bids for this load post", 401)
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

exports.getOffers = BigPromise(async (req, res, next) => {
  const userId = req.user._id;

  try {
    // Find all bids where the current user is the offeredTo person
    const offers = await Bid.find({ offeredTo: userId })
      .populate({
        path: "bidBy",
        select: "name mobile companyName",
      })
      .populate({
        path: "truckId",
        select: "truckNumber truckType truckCapacity vehicleBodyType truckTyre",
      })
      .populate({
        path: "loadId",
        select:
          "materialType weight source destination offeredAmount whenNeeded",
      })
      .sort({ createdAt: -1 }); // Sort by most recent first

    res.status(200).json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    next(new CustomError(error.message, 500));
  }
});

// @desc    Accept a bid/offer
// @route   PUT /api/bids/:id/accept
// @access  Private
exports.acceptBid = BigPromise(async (req, res, next) => {
  const bidId = req.params.id;
  const userId = req.user._id;

  try {
    // Find the bid and populate necessary fields
    const bid = await Bid.findById(bidId)
      .populate({
        path: "bidBy",
        select: "name mobile companyName",
      })
      .populate({
        path: "truckId",
        select: "truckNumber truckType truckCapacity vehicleBodyType truckTyre",
      })
      .populate({
        path: "loadId",
        select:
          "materialType weight source destination offeredAmount whenNeeded",
      });

    if (!bid) {
      return next(new CustomError("Bid not found", 404));
    }

    // Check if the current user is the one who received the offer
    if (bid.offeredTo.toString() !== userId.toString()) {
      return next(new CustomError("Not authorized to accept this bid", 401));
    }

    // Check if bid is already accepted or rejected
    if (bid.status === "ACCEPTED") {
      return next(
        new CustomError(`Bid is already ${bid.status.toLowerCase()}`, 400)
      );
    }

    // Update bid status to ACCEPTED
    bid.status = "ACCEPTED";
    await bid.save();

    try {
      // Send only the bid accepted notification
      await NotificationService.sendBidAcceptedNotification(bid);
    } catch (error) {
      console.error("Error sending bid notification:", error);
      // Don't return error to client, just log it
    }

    // Find or create chat between the two users
    const chat = await Chat.findOrCreateChat(bid.bidBy, bid.offeredTo);

    // Create a formatted bid acceptance message
    const bidAcceptanceMessage =
      `🤝 Bid Accepted!\n\n` +
      `📦 ${bid.materialType}\n` +
      `⚖️ ${bid.weight} Tonnes\n` +
      `🚛 ${bid.truckId.truckType} - ${bid.truckId.truckNumber}\n` +
      `💰 ₹${bid.biddedAmount.total}\n` +
      `📍 From: ${bid.source.placeName}\n` +
      `🎯 To: ${bid.destination.placeName}`;

    // Add bid acceptance message to chat
    await chat.addMessage(
      bid.offeredTo,
      bidAcceptanceMessage,
      "BID_ACCEPTED",
      bid._id
    );

    // If it's a LOAD_BID, update the truck status
    if (bid.bidType === "LOAD_BID") {
      await Truck.findByIdAndUpdate(bid.truckId, {
        $set: { currentBidId: bid._id },
      });
    }

    // If it's a TRUCK_REQUEST, update the load post status
    if (bid.bidType === "TRUCK_REQUEST") {
      await LoadPost.findByIdAndUpdate(bid.loadId, {
        $set: { currentBidId: bid._id },
      });
    }

    // Reject all other pending bids for the same truck or load
    if (bid.bidType === "LOAD_BID") {
      await Bid.updateMany(
        {
          _id: { $ne: bid._id },
          truckId: bid.truckId,
          status: "PENDING",
        },
        { status: "REJECTED" }
      );
    } else {
      await Bid.updateMany(
        {
          _id: { $ne: bid._id },
          loadId: bid.loadId,
          status: "PENDING",
        },
        { status: "REJECTED" }
      );
    }

    const user = await User.findById(userId);
    user.BlCoins += 100;
    await user.save();

    res.status(200).json({
      success: true,
      data: bid,
      message: "Bid accepted successfully",
    });
  } catch (error) {
    console.error("Error accepting bid:", error);
    next(new CustomError(error.message, 500));
  }
});
