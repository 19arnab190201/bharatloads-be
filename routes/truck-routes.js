const express = require("express");
const router = express.Router();
const {
  createTruck,
  getUserTrucks,
  getTruck,
  updateTruck,
  deleteTruck,
  verifyTruckRC,
  getNearbyTrucks,
  repostTruck,
  pauseTruck
} = require("../controllers/truckControllers");

const { protect, authorize } = require("../middlewares/auth.js");

// Truck routes

router.route("/truck/nearby").get(getNearbyTrucks);
router.route("/truck").post(protect, createTruck).get(protect, getUserTrucks);
router.route("/truck/repost").post(protect, repostTruck);
router.route("/truck/pause").post(protect, pauseTruck);

router
  .route("/truck/:id")
  .get(protect, getTruck)
  .put(protect, updateTruck)
  .delete(protect, deleteTruck);

// RC Verification route (only for admins)
router.route("/truck/:id/verify").put(protect, authorize("admin"), verifyTruckRC);

module.exports = router;
