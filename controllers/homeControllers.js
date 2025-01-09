const BigPromise = require("../middlewares/BigPromise");
const LoadPost = require("../models/loadPost");
const Truck = require("../models/truck");

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
    });
  } else if (userType === "TRUCKER") {
    const userVehicles = await Truck.find({ truckOwner: req.user._id });
    res.status(200).json({
      success: true,
      message: "Dashboard",
      data: userVehicles,
    });
  }
});
