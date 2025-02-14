const Bid = require("../../models/bid");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");
const User = require("../../models/user");

/**
 * @desc    Get all bids with pagination and stats
 * @route   GET /api/v1/admin/bids
 * @access  Private/Admin
 */
exports.getBids = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      bidType,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (bidType) {
      query.bidType = bidType;
    }

    if (status) {
      query.status = status;
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
    const [totalBids, pendingBids, acceptedBids, rejectedBids] = await Promise.all([
      Bid.countDocuments({}),
      Bid.countDocuments({ status: "PENDING" }),
      Bid.countDocuments({ status: "ACCEPTED" }),
      Bid.countDocuments({ status: "REJECTED" }),
    ]);

    // Get paginated bids with related details
    const bids = await Bid.find(query)
      .populate({
        path: "bidBy",
        select: "name mobile companyName",
      })
      .populate({
        path: "offeredTo",
        select: "name mobile companyName",
      })
      .populate({
        path: "loadId",
        select: "materialType source destination offeredAmount",
      })
      .populate({
        path: "truckId",
        select: "truckNumber truckLocation truckType",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Bid.countDocuments(query);

    res.status(200).json({
      bids,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + bids.length < total,
      },
      stats: {
        totalBids,
        pendingBids,
        acceptedBids,
        rejectedBids,
      },
    });
  } catch (error) {
    console.error("Error in getBids:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Get bid by ID with full details
 * @route   GET /api/v1/admin/bids/:id
 * @access  Private/Admin
 */
exports.getBidById = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id)
      .populate({
        path: "bidBy",
        select: "name mobile companyName",
      })
      .populate({
        path: "offeredTo",
        select: "name mobile companyName",
      })
      .populate({
        path: "loadId",
        select: "materialType source destination offeredAmount weight vehicleBodyType vehicleType numberOfWheels whenNeeded scheduleDate",
      })
      .populate({
        path: "truckId",
        select: "truckNumber truckLocation truckType truckCapacity vehicleBodyType truckBodyType truckTyre",
      });

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    res.status(200).json({
      success: true,
      bid,
    });
  } catch (error) {
    console.error("Error in getBidById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Search bids with advanced filters
 * @route   GET /api/v1/admin/search/bids
 * @access  Private/Admin
 */
exports.searchBids = BigPromise(async (req, res) => {
  console.log("searchBids");
  try {
    const {
      page = 1,
      limit = 10,
      search, // for bidder/offeredTo name
      phone, // for bidder/offeredTo phone
      bidType,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Search by bidder or offeredTo name/phone
    if (search || phone) {
      // First, find users matching the criteria
      const userQuery = {};

      if (search) {
        userQuery.name = { $regex: search, $options: "i" };
      }

      if (phone) {
        userQuery["mobile.phone"] = { $regex: phone, $options: "i" };
      }

      const matchingUsers = await User.find(userQuery).select("_id");
      const userIds = matchingUsers.map(u => u._id);

      if (userIds.length > 0) {
        query.$or = [
          { bidBy: { $in: userIds } },
          { offeredTo: { $in: userIds } }
        ];
      } else if (search || phone) {
        // If searching by user but none found, return no results
        return res.status(200).json({
          bids: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: false,
          },
          stats: {
            totalBids: 0,
            pendingBids: 0,
            acceptedBids: 0,
            rejectedBids: 0,
          },
        });
      }
    }

    // Filter by bid type
    if (bidType && bidType !== " ") {
      query.bidType = bidType;
    }

    // Filter by status
    if (status && status !== " ") {
      query.status = status;
    }

    // Date range filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total counts for stats
    const [totalBids, pendingBids, acceptedBids, rejectedBids] = await Promise.all([
      Bid.countDocuments(query),
      Bid.countDocuments({ ...query, status: "PENDING" }),
      Bid.countDocuments({ ...query, status: "ACCEPTED" }),
      Bid.countDocuments({ ...query, status: "REJECTED" }),
    ]);

    // Get paginated bids with related details
    const bids = await Bid.find(query)
      .populate({
        path: "bidBy",
        select: "name mobile companyName",
      })
      .populate({
        path: "offeredTo",
        select: "name mobile companyName",
      })
      .populate({
        path: "loadId",
        select: "materialType source destination offeredAmount",
      })
      .populate({
        path: "truckId",
        select: "truckNumber truckLocation truckType",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      bids,
      pagination: {
        total: totalBids,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + bids.length < totalBids,
      },
      stats: {
        totalBids,
        pendingBids,
        acceptedBids,
        rejectedBids,
      },
    });
  } catch (error) {
    console.error("Error in searchBids:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}); 