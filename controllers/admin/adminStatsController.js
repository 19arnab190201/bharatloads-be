const LoadPost = require("../../models/loadPost");
const User = require("../../models/user");
const Truck = require("../../models/truck");
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
    const dailyStats = await Promise.all([
      // Users created per day
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            truckers: {
              $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] }
            },
            transporters: {
              $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Trucks registered per day
      Truck.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$RCVerificationStatus", "PENDING"] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Loads posted per day
      LoadPost.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
            },
            totalAmount: { $sum: "$offeredAmount.total" }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Get overall stats
    const [userStats, truckStats, loadStats] = await Promise.all([
      // User statistics
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            truckers: {
              $sum: { $cond: [{ $eq: ["$userType", "TRUCKER"] }, 1, 0] }
            },
            transporters: {
              $sum: { $cond: [{ $eq: ["$userType", "TRANSPORTER"] }, 1, 0] }
            },
            verified: {
              $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] }
            }
          }
        }
      ]),

      // Truck statistics
      Truck.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ["$isRCVerified", true] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$RCVerificationStatus", "PENDING"] }, 1, 0] }
            }
          }
        }
      ]),

      // Load statistics
      LoadPost.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
            },
            totalAmount: { $sum: "$offeredAmount.total" },
            avgAmount: { $avg: "$offeredAmount.total" }
          }
        }
      ])
    ]);

    // Get material type distribution
    const materialTypeDistribution = await LoadPost.aggregate([
      {
        $group: {
          _id: "$materialType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get truck type distribution
    const truckTypeDistribution = await Truck.aggregate([
      {
        $group: {
          _id: "$truckType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyStats: {
          users: dailyStats[0],
          trucks: dailyStats[1],
          loads: dailyStats[2]
        },
        overallStats: {
          users: userStats[0] || { total: 0, truckers: 0, transporters: 0, verified: 0 },
          trucks: truckStats[0] || { total: 0, verified: 0, pending: 0 },
          loads: loadStats[0] || { total: 0, active: 0, totalAmount: 0, avgAmount: 0 }
        },
        distributions: {
          materialTypes: materialTypeDistribution,
          truckTypes: truckTypeDistribution
        }
      }
    });
  } catch (error) {
    console.error("Error in getStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}); 