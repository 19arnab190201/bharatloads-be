const express = require("express");
const router = express.Router();
const { protect } = require('../middleware/auth');

const { home, getDashboard} = require("../controllers/homeControllers");

router.route("/home").get(home);
router.route("/dashboard").get(protect, getDashboard);


module.exports = router;
