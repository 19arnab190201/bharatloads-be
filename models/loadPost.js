const mongoose = require("mongoose");


const loadPostSchema = new mongoose.Schema(
  {
    transporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    materialType: { type: String, required: true, enum: [
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
    ] },
    weight: { type: Number },
    source: { 
      
          placeName: { type: String, required: true }, // Name of the place
          coordinates: { // Geographical coordinates
              latitude: { type: Number, required: true },
              longitude: { type: Number, required: true }
          
      },
  },
  destination: { 
      
          placeName: { type: String, required: true }, // Name of the place
          coordinates: { // Geographical coordinates
              latitude: { type: Number, required: true },
              longitude: { type: Number, required: true }
          
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
