const express = require("express");
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { home, getDashboard, getLocation } = require("../controllers/homeControllers");

router.route("/home").get(home);
router.route("/dashboard").get(protect, getDashboard);
router.route("/locationsearch").get(getLocation);


module.exports = router;
