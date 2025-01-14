const mongoose = require("mongoose");
const BidSchema = new mongoose.Schema(
  {
    bidType: {
      type: String,
      enum: ["LOAD_BID", "TRUCK_REQUEST"], // LOAD_BID: Bid on a load by TRUCKERS, TRUCK_REQUEST: Request for a truck
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
      dieselLiters: { type: Number, required: true },
    },
    source: {
      placeName: { type: String, required: true }, // Name of the place
      coordinates: {
        // Geographical coordinates
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    destination: {
      placeName: { type: String, required: true }, // Name of the place
      coordinates: {
        // Geographical coordinates
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    // expiresAt: {
    //   type: Date,
    //   default: () => new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bid", BidSchema);
