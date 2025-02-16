const LoadPost = require("../../models/loadPost");
const User = require("../../models/user");
const Truck = require("../../models/truck");
const Bid = require("../../models/bid");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Get comprehensive statistics for admin dashboard
 * @route   GET /api/v1/admin/stats
 * @access  Private/Admin
 */
exports.getStats = BigPromise(async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    if (timeRange === "7d") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (timeRange === "90d") {
      startDate.setDate(startDate.getDate() - 90);
    }

    // Get daily stats for the time range
    const [userStats, truckStats, loadStats, bidStats] = await Promise.all([
      // Users created per day
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            truckers: {
              $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] },
            },
            transporters: {
              $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] },
            },
            verified: {
              $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Trucks registered per day
      Truck.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] },
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$RCVerificationStatus", "PENDING"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Loads posted per day
      LoadPost.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
            totalAmount: { $sum: "$offeredAmount.total" },
            avgAmount: { $avg: "$offeredAmount.total" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Bids per day
      Bid.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            accepted: {
              $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
            },
            totalAmount: { $sum: "$biddedAmount.total" },
            avgAmount: { $avg: "$biddedAmount.total" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Get overall stats
    const [userOverall, truckOverall, loadOverall, bidOverall] =
      await Promise.all([
        // User statistics
        User.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              truckers: {
                $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] },
              },
              transporters: {
                $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] },
              },
              verified: {
                $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
              },
            },
          },
        ]),

        // Truck statistics
        Truck.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: {
                $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] },
              },
              pending: {
                $sum: {
                  $cond: [{ $eq: ["$RCVerificationStatus", "PENDING"] }, 1, 0],
                },
              },
            },
          },
        ]),

        // Load statistics
        LoadPost.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
              },
              totalAmount: { $sum: "$offeredAmount.total" },
              avgAmount: { $avg: "$offeredAmount.total" },
            },
          },
        ]),

        // Bid statistics
        Bid.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              accepted: {
                $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] },
              },
              rejected: {
                $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
              },
              totalAmount: { $sum: "$biddedAmount.total" },
              avgAmount: { $avg: "$biddedAmount.total" },
            },
          },
        ]),
      ]);

    // Get distributions
    const [materialTypes, truckTypes, routeStats] = await Promise.all([
      // Material type distribution
      LoadPost.aggregate([
        {
          $group: {
            _id: "$materialType",
            count: { $sum: 1 },
            totalAmount: { $sum: "$offeredAmount.total" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Truck type distribution
      Truck.aggregate([
        {
          $group: {
            _id: "$truckType",
            count: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Popular routes
      LoadPost.aggregate([
        {
          $group: {
            _id: {
              source: "$source.placeName",
              destination: "$destination.placeName",
            },
            count: { $sum: 1 },
            avgAmount: { $avg: "$offeredAmount.total" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats: {
          users: userStats,
          trucks: truckStats,
          loads: loadStats,
          bids: bidStats,
        },
        overallStats: {
          users: userOverall[0] || {
            total: 0,
            truckers: 0,
            transporters: 0,
            verified: 0,
          },
          trucks: truckOverall[0] || { total: 0, verified: 0, pending: 0 },
          loads: loadOverall[0] || {
            total: 0,
            active: 0,
            totalAmount: 0,
            avgAmount: 0,
          },
          bids: bidOverall[0] || {
            total: 0,
            accepted: 0,
            rejected: 0,
            totalAmount: 0,
            avgAmount: 0,
          },
        },
        distributions: {
          materialTypes,
          truckTypes,
          popularRoutes: routeStats,
        },
      },
    });
  } catch (error) {
    console.error("Error in getStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Add new endpoints for specific statistics

exports.getUserStats = BigPromise(async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const endDate = new Date();
    let startDate = new Date();

    if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (timeRange === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (timeRange === "90d") startDate.setDate(startDate.getDate() - 90);

    const [dailyStats, userTypes, verificationStats, activityStats] =
      await Promise.all([
        // Daily user registration stats
        User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              total: { $sum: 1 },
              truckers: {
                $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] },
              },
              transporters: {
                $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // User type distribution
        User.aggregate([
          {
            $group: {
              _id: "$userType",
              count: { $sum: 1 },
              verified: {
                $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
              },
            },
          },
        ]),

        // Verification statistics
        User.aggregate([
          {
            $group: {
              _id: "$isVerified",
              count: { $sum: 1 },
              truckers: {
                $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] },
              },
              transporters: {
                $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] },
              },
            },
          },
        ]),

        // User activity stats (based on last login)
        User.aggregate([
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $gt: [
                          "$lastLogin",
                          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        ],
                      },
                      then: "LAST_7_DAYS",
                    },
                    {
                      case: {
                        $gt: [
                          "$lastLogin",
                          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        ],
                      },
                      then: "LAST_30_DAYS",
                    },
                  ],
                  default: "INACTIVE",
                },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats,
        userTypes,
        verificationStats,
        activityStats,
      },
    });
  } catch (error) {
    console.error("Error in getUserStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

exports.getLoadStats = BigPromise(async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const endDate = new Date();
    let startDate = new Date();

    if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (timeRange === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (timeRange === "90d") startDate.setDate(startDate.getDate() - 90);

    const [dailyStats, materialStats, routeStats, priceStats] =
      await Promise.all([
        // Daily load posting stats
        LoadPost.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
              totalAmount: { $sum: "$offeredAmount.total" },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Material type statistics
        LoadPost.aggregate([
          {
            $group: {
              _id: "$materialType",
              count: { $sum: 1 },
              avgAmount: { $avg: "$offeredAmount.total" },
              totalAmount: { $sum: "$offeredAmount.total" },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Popular routes
        LoadPost.aggregate([
          {
            $group: {
              _id: {
                source: "$source.placeName",
                destination: "$destination.placeName",
              },
              count: { $sum: 1 },
              avgAmount: { $avg: "$offeredAmount.total" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        // Price range distribution
        LoadPost.aggregate([
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: { $lte: ["$offeredAmount.total", 5000] },
                      then: "0-5K",
                    },
                    {
                      case: { $lte: ["$offeredAmount.total", 10000] },
                      then: "5K-10K",
                    },
                    {
                      case: { $lte: ["$offeredAmount.total", 20000] },
                      then: "10K-20K",
                    },
                    {
                      case: { $lte: ["$offeredAmount.total", 50000] },
                      then: "20K-50K",
                    },
                  ],
                  default: "50K+",
                },
              },
              count: { $sum: 1 },
              totalAmount: { $sum: "$offeredAmount.total" },
            },
          },
        ]),
      ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats,
        materialStats,
        routeStats,
        priceStats,
      },
    });
  } catch (error) {
    console.error("Error in getLoadStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

exports.getTruckStats = BigPromise(async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const endDate = new Date();
    let startDate = new Date();

    if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (timeRange === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (timeRange === "90d") startDate.setDate(startDate.getDate() - 90);

    const [dailyStats, truckTypeStats, verificationStats, capacityStats] =
      await Promise.all([
        // Daily truck registration stats
        Truck.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
              verified: {
                $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Truck type distribution
        Truck.aggregate([
          {
            $group: {
              _id: "$truckType",
              count: { $sum: 1 },
              verified: {
                $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] },
              },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Verification status
        Truck.aggregate([
          {
            $group: {
              _id: "$RCVerificationStatus",
              count: { $sum: 1 },
            },
          },
        ]),

        // Capacity distribution
        Truck.aggregate([
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $lte: ["$truckCapacity", 5] }, then: "0-5T" },
                    { case: { $lte: ["$truckCapacity", 10] }, then: "5-10T" },
                    { case: { $lte: ["$truckCapacity", 20] }, then: "10-20T" },
                    { case: { $lte: ["$truckCapacity", 30] }, then: "20-30T" },
                  ],
                  default: "30T+",
                },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats,
        truckTypeStats,
        verificationStats,
        capacityStats,
      },
    });
  } catch (error) {
    console.error("Error in getTruckStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

exports.getBidStats = BigPromise(async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const endDate = new Date();
    let startDate = new Date();

    if (timeRange === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (timeRange === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (timeRange === "90d") startDate.setDate(startDate.getDate() - 90);

    const [dailyStats, statusStats, amountStats, responseTimeStats] =
      await Promise.all([
        // Daily bid stats
        Bid.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
              accepted: {
                $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] },
              },
              totalAmount: { $sum: "$biddedAmount.total" },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Bid status distribution
        Bid.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              avgAmount: { $avg: "$biddedAmount.total" },
            },
          },
        ]),

        // Bid amount distribution
        Bid.aggregate([
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: { $lte: ["$biddedAmount.total", 5000] },
                      then: "0-5K",
                    },
                    {
                      case: { $lte: ["$biddedAmount.total", 10000] },
                      then: "5K-10K",
                    },
                    {
                      case: { $lte: ["$biddedAmount.total", 20000] },
                      then: "10K-20K",
                    },
                    {
                      case: { $lte: ["$biddedAmount.total", 50000] },
                      then: "20K-50K",
                    },
                  ],
                  default: "50K+",
                },
              },
              count: { $sum: 1 },
              totalAmount: { $sum: "$biddedAmount.total" },
            },
          },
        ]),

        // Response time analysis
        Bid.aggregate([
          {
            $match: {
              status: "ACCEPTED",
            },
          },
          {
            $project: {
              responseTime: {
                $divide: [
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  1000 * 60, // Convert to minutes
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: { $lte: ["$responseTime", 30] },
                      then: "< 30 mins",
                    },
                    {
                      case: { $lte: ["$responseTime", 60] },
                      then: "30-60 mins",
                    },
                    {
                      case: { $lte: ["$responseTime", 180] },
                      then: "1-3 hours",
                    },
                    {
                      case: { $lte: ["$responseTime", 360] },
                      then: "3-6 hours",
                    },
                  ],
                  default: "> 6 hours",
                },
              },
              count: { $sum: 1 },
              avgResponseTime: { $avg: "$responseTime" },
            },
          },
        ]),
      ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats,
        statusStats,
        amountStats,
        responseTimeStats,
      },
    });
  } catch (error) {
    console.error("Error in getBidStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
