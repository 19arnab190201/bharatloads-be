const BigPromise = require("../middlewares/bigPromise");

exports.home = BigPromise(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Bharatloads API",
  });
});
