const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  logout,
  verifyOtp,
  getLoggedInUserDetails,
  updateUserDetails,
  signupVerifyOTP,
  getUserCoins,
} = require("../controllers/userControllers");

const { isLoggedIn } = require("../middlewares/user");

router.route("/signup").post(signup);
// router.route("/signup/verify-otp").post(signupVerifyOTP);
router.route("/login").post(login); // Step to generate OTP
router.route("/verify-otp").post(verifyOtp); // Step to verify OTP
router.route("/logout").get(logout);
router.route("/user/profile").get(isLoggedIn, getLoggedInUserDetails);
router.route("/user/update").put(isLoggedIn, updateUserDetails);
router.route("/user/coins").get(isLoggedIn, getUserCoins);

module.exports = router;
