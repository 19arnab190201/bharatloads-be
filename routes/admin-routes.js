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
} = require("../controllers/adminControllers");

const { isAdmin } = require("../middlewares/admin");
const { protect, authorize } = require("../middlewares/auth");

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);

// Protected routes
router.get("/profile", isAdmin, getProfile);
router.get("/users", isAdmin, getUsers);
router.get("/users/:id", isAdmin, getUserById);
router.get(
  "/logs/:entityType/:entityId",
  protect,
  authorize("ADMIN"),
  getEntityLogs
);

// //Load routes
// router.get("/admin/loads/:id", getLoadById);
// router.get("/admin/loads/user/:userId", getLoadsByUserId);

// //Truck routes
// router.get("/admin/trucks/:id", getTruckById);
// router.get("/admin/trucks/user/:userId", getTrucksByUserId);

module.exports = router;
