const express = require('express');
const router = express.Router();
const { 
  createLoadPost, 
  getUserLoadPosts, 
  getLoadPost, 
  updateLoadPost, 
  deleteLoadPost,
  getActiveLoadPosts,
  getNearbyLoadPosts,
  repostLoad,
  pauseLoad
} = require('../controllers/loadControllers');

const bidRouter = require('./bid-routes'); // Nested routing for bids

const { protect } = require('../middlewares/auth');

// Load routes
router.route('/load')
  .post(protect, createLoadPost)
  .get(protect, getUserLoadPosts);

router.route('/load/active')
  .get(protect, getActiveLoadPosts);

router.route('/load/nearby')
  .get( getNearbyLoadPosts);

router.route('/load/:id')
  .get(protect, getLoadPost)
  .put(protect, updateLoadPost)
  .delete(protect, deleteLoadPost);

router.route("/load/repost").post(protect, repostLoad);
router.route("/load/pause").post(protect, pauseLoad);

//Recommend truck to transporter
//router.route('/load/:id/recommend').post(protect, recommendTruck);

// Nested route for bids
router.use('/load/:loadId/bids', bidRouter);

module.exports = router;
