const LoadPost = require("../../models/loadPost");
const User = require("../../models/user");
const Truck = require("../../models/truck");
const BigPromise = require("../../middlewares/BigPromise");
const CustomError = require("../../utils/CustomError");

/**
 * @desc    Search trucks with optimized MongoDB queries for accurate results
 * @route   GET /api/v1/admin/search/trucks
 * @access  Private/Admin
 */
exports.searchTrucks = BigPromise(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      ownerName,
      phone,
      location,
      truckNumber,
      isRCVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Check if any search parameter is provided
    const hasSearchParams = ownerName || phone || location || truckNumber || isRCVerified !== undefined;
    
    // If no search parameters are provided, return an empty result
    if (!hasSearchParams) {
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

    // Build the query object
    let ownerIds = [];
    let truckQuery = {};

    // Handle owner search (name or phone)
    if (ownerName || phone) {
      const ownerQuery = {};
      
      if (ownerName) {
        // Use text search for better name matching
        const normalizedName = ownerName.trim().replace(/\s+/g, ' ');
        
        // Create a case-insensitive regex that matches the name as a substring
        // This is more flexible than exact matching
        ownerQuery.name = { $regex: normalizedName, $options: 'i' };
      }
      
      if (phone) {
        // Clean the phone number to contain only digits
        const cleanedPhone = phone.replace(/\D/g, '');
        
        // For phone numbers, use a starts-with approach for better matching
        ownerQuery["mobile.phone"] = { $regex: `^${cleanedPhone}`, $options: 'i' };
      }
      
      // Find owners matching the criteria
      const matchingOwners = await User.find(ownerQuery).select("_id");
      ownerIds = matchingOwners.map(o => o._id);
      
      if (ownerIds.length > 0) {
        truckQuery.truckOwner = { $in: ownerIds };
      } else if (ownerName || phone) {
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
    
    // Search by location
    if (location) {
      const normalizedLocation = location.trim().replace(/\s+/g, ' ');
      // Use a contains approach for location search
      truckQuery["truckLocation.placeName"] = { $regex: normalizedLocation, $options: 'i' };
    }
    
    // Search by truck number
    if (truckNumber) {
      // Remove spaces and hyphens for consistent matching
      const cleanedTruckNumber = truckNumber.replace(/[\s-]/g, '').toUpperCase();
      // Use a contains approach for truck number search
      truckQuery.truckNumber = { $regex: cleanedTruckNumber, $options: 'i' };
    }
    
    // Filter by verification status
    if (isRCVerified !== undefined) {
      truckQuery.isRCVerified = isRCVerified === "true";
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total counts for stats
    const [totalTrucks, verifiedTrucks, pendingVerification] = await Promise.all([
      Truck.countDocuments(truckQuery),
      Truck.countDocuments({ ...truckQuery, isRCVerified: true }),
      Truck.countDocuments({ ...truckQuery, RCVerificationStatus: "PENDING" }),
    ]);
    
    // If no trucks found with the given criteria, return empty result
    if (totalTrucks === 0) {
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
    
    // Get paginated trucks with owner details
    const trucks = await Truck.find(truckQuery)
      .populate({
        path: "truckOwner",
        select: "name mobile userType companyName",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-RCImage"); // Exclude heavy RC image data
    
    res.status(200).json({
      trucks,
      pagination: {
        total: totalTrucks,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + trucks.length < totalTrucks,
      },
      stats: {
        totalTrucks,
        verifiedTrucks,
        pendingVerification,
      },
    });
  } catch (error) {
    console.error("Error in searchTrucks:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @desc    Search loads with optimized MongoDB queries for accurate results
 * @route   GET /api/v1/admin/search/loads
 * @access  Private/Admin
 */
exports.searchLoads = BigPromise(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search, // for transporter name
      transporterName, // alternative parameter name for consistency
      phone, // for transporter phone
      source,
      destination,
      materialType,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Check if any search parameter is provided
    const hasSearchParams = search || transporterName || phone || source || destination || 
                           materialType || (startDate && endDate);
    
    // If no search parameters are provided, return an empty result
    if (!hasSearchParams) {
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

    // Build query
    let loadQuery = {};

    // Add material type filter
    if (materialType) {
      loadQuery.materialType = materialType;
    }

    // Search by transporter name or phone
    // Use transporterName if provided, otherwise fall back to search parameter
    const effectiveTransporterName = transporterName || search;
    
    if (effectiveTransporterName || phone) {
      // First, find transporters matching the criteria
      const transporterQuery = {};

      if (effectiveTransporterName) {
        // Normalize the search term by trimming and removing extra spaces
        const normalizedName = effectiveTransporterName.trim().replace(/\s+/g, ' ');
        
        // Create a case-insensitive regex that matches the name as a substring
        transporterQuery.name = { $regex: normalizedName, $options: 'i' };
      }

      if (phone) {
        // Clean the phone number to contain only digits
        const cleanedPhone = phone.replace(/\D/g, '');
        
        // For phone numbers, use a starts-with approach for better matching
        transporterQuery["mobile.phone"] = { $regex: `^${cleanedPhone}`, $options: 'i' };
      }

      const matchingTransporters = await User.find(transporterQuery).select("_id");
      const transporterIds = matchingTransporters.map(t => t._id);

      if (transporterIds.length > 0) {
        loadQuery.transporterId = { $in: transporterIds };
      } else if (effectiveTransporterName || phone) {
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

    // Search by source location
    if (source) {
      const normalizedSource = source.trim().replace(/\s+/g, ' ');
      // Use a contains approach for source search
      loadQuery["source.placeName"] = { $regex: normalizedSource, $options: 'i' };
    }

    // Search by destination location
    if (destination) {
      const normalizedDestination = destination.trim().replace(/\s+/g, ' ');
      // Use a contains approach for destination search
      loadQuery["destination.placeName"] = { $regex: normalizedDestination, $options: 'i' };
    }

    // Date range filter
    if (startDate && endDate) {
      loadQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total counts for stats
    const [totalLoads, activeLoads] = await Promise.all([
      LoadPost.countDocuments(loadQuery),
      LoadPost.countDocuments({ ...loadQuery, isActive: true }),
    ]);

    // If no loads found with the given criteria, return empty result
    if (totalLoads === 0) {
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

    // Get paginated loads with transporter details
    const loads = await LoadPost.find(loadQuery)
      .populate({
        path: "transporterId",
        select: "name mobile companyName",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      loads,
      pagination: {
        total: totalLoads,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + loads.length < totalLoads,
      },
      stats: {
        totalLoads,
        activeLoads,
      },
    });
  } catch (error) {
    console.error("Error in searchLoads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}); 