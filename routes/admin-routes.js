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

const { getTrucks, getTruckById, verifyTruck } = require("../controllers/admin/adminTruckController");

const { getLoads, getLoadById } = require("../controllers/admin/adminLoadController");

const { searchLoads, searchTrucks } = require("../controllers/admin/adminSearchController");

const { getStats } = require("../controllers/admin/adminStatsController");

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

// Stats routes
router.get("/admin/stats", isAdmin, getStats);

// Admin users management routes (Super Admin only)
router.put("/admin/update/:id", isAdmin, updateAdmin);
router.get("/admins", isAdmin, getAllAdmins);
router.post("/admin/create", isAdmin, createAdmin);

module.exports = router;
