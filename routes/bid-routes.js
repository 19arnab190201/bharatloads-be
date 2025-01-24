const express = require("express");
// Use mergeParams to allow access to loadId from parent route
const router = express.Router({ mergeParams: true });
const {
  createBidForTransporter,
  createBidForTrucker,
  getUserBids,
  getBid,
  updateBid,
  deleteBid,
  updateBidStatus,
  getLoadBids,
  searchBids,
  getBidStatistics,
  getOffers,
} = require("../controllers/bidControllers");

const { protect } = require("../middlewares/auth");

// Bid routes
router
  .route("/bid")
  .post(protect, createBidForTransporter)
  .get(protect, getUserBids);

router
  .route("/bid/truck")
  .post(protect, createBidForTrucker)
  .get(protect, getUserBids);
// Search and statistics routes
router.route("/bid/search").get(protect, searchBids);

router.route("/bid/stats").get(protect, getBidStatistics);

router
  .route("/bid/:id")
  .get(protect, getBid)
  .put(protect, updateBid)
  .delete(protect, deleteBid);

// Bid status update route
router.route("/bid/:id/status").put(protect, updateBidStatus);

// Nested route to get bids for a specific load
router.route("/bid/load").get(protect, getLoadBids);

// Offer routes
router.route("/offer").get(protect, getOffers);

module.exports = router;
