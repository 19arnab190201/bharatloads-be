const LoadPost = require("../../models/loadPost");
const User = require("../../models/user");
const Truck = require("../../models/truck");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Search trucks with advanced filters
 * @route   GET /api/v1/admin/search/trucks
 * @access  Private/Admin
 */
exports.searchTrucks = BigPromise(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search, // for owner name
      phone, // for owner phone
      truckNumber,
      isRCVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    // Search by owner name or phone
    if (search || phone) {
      // First, find owners matching the criteria
      const ownerQuery = {};

      if (search) {
        ownerQuery.name = { $regex: search, $options: "i" };
      }

      if (phone) {
        ownerQuery["mobile.phone"] = { $regex: phone, $options: "i" };
      }

      const matchingOwners = await User.find(ownerQuery).select("_id");
      const ownerIds = matchingOwners.map(o => o._id);

      if (ownerIds.length > 0) {
        query.truckOwner = { $in: ownerIds };
      } else if (search || phone) {
        // If searching by owner but none found, return no results
        return res.status(200).json({
          trucks: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: false,
          },
          stats: {
            totalTrucks: 0,
            verifiedTrucks: 0,
            pendingVerification: 0,
          },
        });
      }
    }

    // Search by truck number
    if (truckNumber) {
      query.truckNumber = { $regex: truckNumber, $options: "i" };
    }

    // Filter by verification status
    if (isRCVerified !== undefined) {
      query.isRCVerified = isRCVerified === "true";
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total counts for stats
    const [totalTrucks, verifiedTrucks, pendingVerification] = await Promise.all([
      Truck.countDocuments(query),
      Truck.countDocuments({ ...query, isRCVerified: true }),
      Truck.countDocuments({ ...query, RCVerificationStatus: "PENDING" }),
    ]);

    // Get paginated trucks with owner details
    const trucks = await Truck.find(query)
      .populate({
        path: "truckOwner",
        select: "name mobile userType companyName",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-RCImage"); // Exclude heavy RC image data

    // Get total count for pagination
    const total = await Truck.countDocuments(query);

    res.status(200).json({
      trucks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + trucks.length < total,
      },
      stats: {
        totalTrucks,
        verifiedTrucks,
        pendingVerification,
      },
    });
  } catch (error) {
    console.error("Error in searchTrucks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * @desc    Search loads with advanced filters
 * @route   GET /api/v1/admin/search/loads
 * @access  Private/Admin
 */
exports.searchLoads = BigPromise(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search, // for transporter name
      phone, // for transporter phone
      source,
      destination,
      materialType,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (materialType) {
      query.materialType = materialType;
    }

    // Search by transporter name or phone
    if (search || phone) {
      // First, find transporters matching the criteria
      const transporterQuery = {};

      if (search) {
        transporterQuery.name = { $regex: search, $options: "i" };
      }

      if (phone) {
        transporterQuery["mobile.phone"] = { $regex: phone, $options: "i" };
      }

      const matchingTransporters = await User.find(transporterQuery).select("_id");
      const transporterIds = matchingTransporters.map(t => t._id);

      if (transporterIds.length > 0) {
        query.transporterId = { $in: transporterIds };
      } else if (search || phone) {
        // If searching by transporter but none found, return no results
        return res.status(200).json({
          loads: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: false,
          },
          stats: {
            totalLoads: 0,
            activeLoads: 0,
          },
        });
      }
    }

    // Search by source or destination
    if (source) {
      query["source.placeName"] = { $regex: source, $options: "i" };
    }

    if (destination) {
      query["destination.placeName"] = { $regex: destination, $options: "i" };
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
    const [totalLoads, activeLoads] = await Promise.all([
      LoadPost.countDocuments(query),
      LoadPost.countDocuments({ ...query, isActive: true }),
    ]);

    // Get paginated loads with transporter details
    const loads = await LoadPost.find(query)
      .populate({
        path: "transporterId",
        select: "name mobile companyName",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await LoadPost.countDocuments(query);

    res.status(200).json({
      loads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + loads.length < total,
      },
      stats: {
        totalLoads,
        activeLoads,
      },
    });
  } catch (error) {
    console.error("Error in searchLoads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}); 