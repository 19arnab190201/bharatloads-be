const mongoose = require("mongoose");
const { MATERIALS } = require("../constants");

const loadPostSchema = new mongoose.Schema(
  {
    transporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    materialType: { type: String, required: true, enum: MATERIALS },
    weight: { type: Number },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    vehicleBodyType: {
      type: String,
      enum: ["OPEN_BODY", "CLOSED_BODY"],
      required: true,
    },
    vehicleType: {
      type: String,
      enum: ["TRAILER", "TRUCK", "HYVA"],
      required: true,
    },
    numberOfWheels: {
      type: Number,
    },
    offeredAmount: {
      total: { type: Number, required: true },
      advancePercentage: { type: Number, required: true },
      dieselLiters: { type: Number, required: true },
    },
    whenNeeded: {
      type: String,
      enum: ["IMMEDIATE", "SCHEDULED"],
      required: true,
    },
    bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }], // Bids made by truckers
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoadPost", loadPostSchema);
