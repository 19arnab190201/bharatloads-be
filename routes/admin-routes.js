const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  verifyOtp,
  getProfile,
  getUsers,
  getUserById,
} = require("../controllers/adminControllers");

const { isAdmin } = require("../middlewares/admin");

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);

// Protected routes
router.get("/profile", isAdmin, getProfile);
router.get("/users", isAdmin, getUsers);
router.get("/users/:id", isAdmin, getUserById);

module.exports = router;
