const mongoose = require("mongoose");

const loadPostSchema = new mongoose.Schema(
  {
    transporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    materialType: {
      type: String,
      required: true,
      enum: [
        "IRON SHEET",
        "INDUSTRIAL EQUIPMENT",
        "CEMENT",
        "COAL",
        "STEEL",
        "IRON BARS",
        "PIPES",
        "METALS",
        "SCRAPS",
        "OIL",
        "RUBBER",
        "WOOD",
        "VEHICLE PARTS",
        "LEATHER",
        "WHEAT",
        "VEGETABLES",
        "COTTON",
        "TEXTILES",
        "RICE",
        "SPICES",
        "PACKAGED FOOD",
        "MEDICINES",
        "OTHERS",
      ],
    },
    weight: { type: Number, required: true },
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
      required: true,
    },
    offeredAmount: {
      total: { type: Number, required: true },
      advancePercentage: { type: Number, required: true },
      dieselAmount: { type: Number, required: true },
    },
    whenNeeded: {
      type: String,
      enum: ["IMMEDIATE", "SCHEDULED"],
      required: true,
    },
    bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }], // Bids made by truckers
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoadPost", loadPostSchema);
