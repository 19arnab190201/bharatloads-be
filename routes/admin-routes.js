const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  verifyOtp,
  getProfile,
  getUsers,
  getUserById,
  getEntityLogs,
} = require("../controllers/admin/adminControllers");

const {
  getAllAdmins,
  createAdmin,
  updateAdmin,
} = require("../controllers/admin/adminUsersController");

const {
  getTrucks,
  getTruckById,
  verifyTruck,
} = require("../controllers/admin/adminTruckController");

const {
  getLoads,
  getLoadById,
} = require("../controllers/admin/adminLoadController");

const {
  searchLoads,
  searchTrucks,
} = require("../controllers/admin/adminSearchController");

const {
  getBids,
  getBidById,
  searchBids,
} = require("../controllers/admin/adminBidController");

const {
  getStats,
  getUserStats,
  getLoadStats,
  getTruckStats,
  getBidStats,
} = require("../controllers/admin/adminStatsController");

const { isAdmin } = require("../middlewares/admin");
const { protect, authorize } = require("../middlewares/auth");

// Public routes
router.post("/admin/signup", signup);
router.post("/admin/login", login);
router.post("/admin/verify-otp", verifyOtp);

// Protected routes
router.get("/admin/profile", isAdmin, getProfile);
router.get("/admin/users", isAdmin, getUsers);
router.get("/admin/users/:id", isAdmin, getUserById);
router.get("/admin/entity-logs/:entityType/:entityId", isAdmin, getEntityLogs);

// Truck routes
router.get("/admin/trucks", isAdmin, getTrucks);
router.get("/admin/trucks/:id", isAdmin, getTruckById);
router.put("/admin/trucks/:id/verify", isAdmin, verifyTruck);

// Load routes
router.get("/admin/loads", isAdmin, getLoads);
router.get("/admin/loads/:id", isAdmin, getLoadById);

// Search routes
router.get("/admin/search/loads", isAdmin, searchLoads);
router.get("/admin/search/trucks", isAdmin, searchTrucks);
router.get("/admin/search/bids", isAdmin, searchBids);

// Bid routes
router.get("/admin/bids", isAdmin, getBids);
router.get("/admin/bids/:id", isAdmin, getBidById);

// Stats routes
router.get("/admin/stats", isAdmin, getStats);
router.get("/admin/stats/users", isAdmin, getUserStats);
router.get("/admin/stats/loads", isAdmin, getLoadStats);
router.get("/admin/stats/trucks", isAdmin, getTruckStats);
router.get("/admin/stats/bids", isAdmin, getBidStats);

// Admin users management routes (Super Admin only)
router.put("/admin/update/:id", isAdmin, updateAdmin);
router.get("/admins", isAdmin, getAllAdmins);
router.post("/admin/create", isAdmin, createAdmin);

module.exports = router;
