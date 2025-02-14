const LoadPost = require("../../models/loadPost");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Get all loads with pagination and stats
 * @route   GET /api/v1/admin/loads
 * @access  Private/Admin
 */
exports.getLoads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      materialType,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};

    // Add filters
    if (materialType) {
      query.materialType = materialType;
    }

    if (search) {
      query.$or = [
        { "source.placeName": { $regex: search, $options: "i" } },
        { "destination.placeName": { $regex: search, $options: "i" } },
      ];
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
    const [totalLoads, activeLoads] = await Promise.all([
      LoadPost.countDocuments({}),
      LoadPost.countDocuments({ isActive: true }),
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
    console.error("Error in getLoads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @desc    Get load by ID with full details
 * @route   GET /api/v1/admin/loads/:id
 * @access  Private/Admin
 */
exports.getLoadById = async (req, res) => {
  try {
    const load = await LoadPost.findById(req.params.id)
      .populate({
        path: "transporterId",
        select: "name mobile companyName companyLocation",
      })
      .populate({
        path: "bids",
        populate: {
          path: "bidBy",
          select: "name mobile companyName",
        },
      });

    if (!load) {
      return res.status(404).json({
        success: false,
        message: "Load not found",
      });
    }

    res.status(200).json({
      success: true,
      load,
    });
  } catch (error) {
    console.error("Error in getLoadById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}; 