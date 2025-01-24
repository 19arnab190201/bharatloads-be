const mongoose = require("mongoose");
const BidSchema = new mongoose.Schema(
  {
    bidType: {
      type: String,
      enum: ["LOAD_BID", "TRUCK_REQUEST"], // LOAD_BID: Bid on a load by TRUCKERS, TRUCK_REQUEST: Request for a truck
      required: true,
    },
    offeredTo:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    loadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoadPost",
      required: true,
    },
    bidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Truck",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },

    // Custom bid fields
    materialType: { type: String },
    weight: { type: Number },
    offeredAmount: {
      total: { type: Number, required: true },
      advancePercentage: { type: Number, required: true },
      dieselAmount: { type: Number, required: true },
    },
    source: {
      placeName: { type: String, required: [true, "Please add a place name for the source location"] },
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Please add coordinates for source"],
      },
    },
    destination: {
      placeName: { type: String, required: [true, "Please add a place name for the destination location"] },
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Please add coordinates for destination"],
      },
    },
    // expiresAt: {
    //   type: Date,
    //   default: () => new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
    // },
  },
  { timestamps: true }
);

// Create 2dsphere indexes for geospatial queries on both source and destination
BidSchema.index({ "source.coordinates": "2dsphere" });
BidSchema.index({ "destination.coordinates": "2dsphere" });

// Middleware to validate coordinates before saving
BidSchema.pre("save", function (next) {
  // Validate source coordinates
  if (this.source.coordinates.length !== 2) {
    next(new Error("Source location must have exactly 2 coordinates [longitude, latitude]"));
  }

  const [sourceLongitude, sourceLatitude] = this.source.coordinates;

  if (sourceLongitude < -180 || sourceLongitude > 180) {
    next(new Error("Source longitude must be between -180 and 180"));
  }

  if (sourceLatitude < -90 || sourceLatitude > 90) {
    next(new Error("Source latitude must be between -90 and 90"));
  }

  // Validate destination coordinates
  if (this.destination.coordinates.length !== 2) {
    next(new Error("Destination location must have exactly 2 coordinates [longitude, latitude]"));
  }

  const [destLongitude, destLatitude] = this.destination.coordinates;

  if (destLongitude < -180 || destLongitude > 180) {
    next(new Error("Destination longitude must be between -180 and 180"));
  }

  if (destLatitude < -90 || destLatitude > 90) {
    next(new Error("Destination latitude must be between -90 and 90"));
  }

  next();
});

module.exports = mongoose.model("Bid", BidSchema);
