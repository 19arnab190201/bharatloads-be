const BigPromise = require("../middlewares/BigPromise");
const LoadPost = require("../models/loadPost");
const Truck = require("../models/truck");
const axios = require("axios");

exports.home = BigPromise(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Bharatloads API",
    lastUpdated: "30-12-2024 | 11:19 AM",
    currentDateTime: new Date(),
    currentServerTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
});

exports.getDashboard = BigPromise(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }
  const userType = req.user.userType;

  console.log("user", userType, req.user);

  if (userType === "TRANSPORTER") {
    const userLoads = await LoadPost.find({ transporterId: req.user._id });
    res.status(200).json({
      success: true,
      message: "Dashboard",
      data: userLoads,
      coins: req.user.BlCoins || 0,
    });
  } else if (userType === "TRUCKER") {
    const userVehicles = await Truck.find({ truckOwner: req.user._id });
    res.status(200).json({
      success: true,
      message: "Dashboard",
      data: userVehicles,
      coins: req.user.BlCoins || 0,
    });
  }
});

exports.getLocation = BigPromise(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  try {
    const response = await axios.get(
      `https://api.olamaps.io/places/v1/autocomplete`,
      {
        params: {
          api_key: process.env.OLA_MAPS_API_KEY,
          input: query,
        },
        headers: {
          'Origin': 'https://bharatloads-be-cd9fce57f28d.herokuapp.com'
        }
      }
    );

    const locations = response.data.predictions.map(place => ({
      name: place.structured_formatting.main_text,
      description: place.description,
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      }
    }));

    res.status(200).json({
      success: true,
      message: "Locations fetched successfully",
      data: locations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching locations",
      error: error
    });
  }
});

