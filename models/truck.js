const mongoose = require("mongoose");

const truckSchema = new mongoose.Schema({
  truckOwner: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  truckPermit: {
    type: String,
    required: [true, "Please add a permit"],
  },
  truckNumber: {
    type: String,
    required: [true, "Please add a truck number"],
    trim: true,
    unique: true,
    maxlength: [10, "Truck number cannot be more than 10 characters"],
  },
  truckLocation: {
    placeName: {
      type: String,
      required: [true, "Please add a place name for the truck location"],
    },
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, "Please add coordinates"],
    },
  },
  truckCapacity: {
    type: Number,
    required: [true, "Please add a capacity"],
  },
  vehicleBodyType: {
    type: String,
    required: [true, "Please add a truck body type"],
    enum: ["OPEN_BODY", "CLOSED_BODY"],
  },
  truckType: {
    type: String,
    required: [true, "Please add a truck type"],
    enum: ["TRUCK", "TRAILER", "HYVA"],
  },
  truckBodyType: {
    type: String,
    required: [true, "Please add a truck type"],
    enum: ["OPEN_FULL_BODY", "OPEN_HALF_BODY", "FULL_CLOSED_BODY"],
  },
  truckTyre: {
    type: Number,
    required: [true, "Please add a tyre"],
  },
  isRCVerified: {
    type: Boolean,
    default: true,
  },
  RCImage: {
    type: String,
    required: [true, "Please add a truck image"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  RCVerificationStatus: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
  rating: [
    {
      rating: {
        type: Number,
        default: 0,
      },
      ratingComment: {
        type: String,
      },
      ratedBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    },
  ],
  totalBids: {
    type: Number,
    default: 0,
  },
  bids: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Bid",
    },
  ],
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
  },
});

// Create a 2dsphere index for geospatial queries
truckSchema.index({ truckLocation: "2dsphere" });

// Middleware to validate coordinates before saving
truckSchema.pre("save", function (next) {
  if (this.truckLocation.coordinates.length !== 2) {
    next(
      new Error(
        "Location must have exactly 2 coordinates [longitude, latitude]"
      )
    );
  }

  const [longitude, latitude] = this.truckLocation.coordinates;

  // Validate longitude (-180 to 180)
  if (longitude < -180 || longitude > 180) {
    next(new Error("Longitude must be between -180 and 180"));
  }

  // Validate latitude (-90 to 90)
  if (latitude < -90 || latitude > 90) {
    next(new Error("Latitude must be between -90 and 90"));
  }

  // Set updatedAt timestamp
  this.updatedAt = new Date();

  next();
});

// Helper method to find trucks within a certain radius (in meters)
truckSchema.statics.findNearby = function (longitude, latitude, maxDistance) {
  return this.find({
    truckLocation: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

module.exports = mongoose.model("Truck", truckSchema);
