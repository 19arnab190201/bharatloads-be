const express = require('express');
// Use mergeParams to allow access to loadId from parent route
const router = express.Router({ mergeParams: true });
const { 
  createBid, 
  getUserBids, 
  getBid, 
  updateBid, 
  deleteBid,
  updateBidStatus,
  getLoadBids,
  searchBids,
  getBidStatistics
} = require('../controllers/bidControllers');

const { protect } = require('../middlewares/auth');

// Bid routes
router.route('/')
  .post(protect, createBid)
  .get(protect, getUserBids);

// Search and statistics routes
router.route('/search')
  .get(protect, searchBids);

router.route('/stats')
  .get(protect, getBidStatistics);

router.route('/:id')
  .get(protect, getBid)
  .put(protect, updateBid)
  .delete(protect, deleteBid);

// Bid status update route
router.route('/:id/status')
  .put(protect, updateBidStatus);

// Nested route to get bids for a specific load
router.route('/load')
  .get(protect, getLoadBids);

module.exports = router;
