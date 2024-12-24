const express = require("express");
const router = express.Router();
const {
  createTruck,
  getUserTrucks,
  getTruck,
  updateTruck,
  deleteTruck,
  verifyTruckRC,
} = require("../controllers/truckControllers");

const { protect, authorize } = require("../middleware/auth.js");

// Truck routes
router.route("/").post(protect, createTruck).get(protect, getUserTrucks);

router
  .route("/:id")
  .get(protect, getTruck)
  .put(protect, updateTruck)
  .delete(protect, deleteTruck);

// RC Verification route (only for admins)
router.route("/:id/verify").put(protect, authorize("admin"), verifyTruckRC);

module.exports = router;
