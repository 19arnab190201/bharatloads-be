const express = require('express');
const router = express.Router();
const { 
  createLoadPost, 
  getUserLoadPosts, 
  getLoadPost, 
  updateLoadPost, 
  deleteLoadPost,
  getActiveLoadPosts
} = require('../controllers/loadControllers');

const bidRouter = require('./bidRoutes'); // Nested routing for bids

const { protect } = require('../middleware/auth');

// Load routes
router.route('/')
  .post(protect, createLoadPost)
  .get(protect, getUserLoadPosts);

router.route('/active')
  .get(protect, getActiveLoadPosts);

router.route('/:id')
  .get(protect, getLoadPost)
  .put(protect, updateLoadPost)
  .delete(protect, deleteLoadPost);

// Nested route for bids
router.use('/:loadId/bids', bidRouter);

module.exports = router;
