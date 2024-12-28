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
    type: {
      placeName: { 
        type: String, 
        required: [true, "Please add a place name for the truck location"] 
      }, // Name of the place
      coordinates: { 
        latitude: { 
          type: Number, 
          required: [true, "Please add the latitude for the truck location"] 
        }, // Latitude of the location
        longitude: { 
          type: Number, 
          required: [true, "Please add the longitude for the truck location"] 
        } // Longitude of the location
      }
    },
    required: [true, "Please provide a valid truck location with coordinates"],
  },
  
  truckCapacity: {
    type: Number,
    required: [true, "Please add a capacity"],
  },
  vehicleBodyType: {
    type: String,
    required: [true, "Please add a truck type"],
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
});

module.exports = mongoose.model("Truck", truckSchema);
