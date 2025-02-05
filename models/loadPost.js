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
      placeName: {
        type: String,
        required: [true, "Please add a place name for the source location"],
      },
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
      placeName: {
        type: String,
        required: [
          true,
          "Please add a place name for the destination location",
        ],
      },
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
      advanceAmount: { type: Number, required: true },
      dieselAmount: { type: Number, required: true },
    },
    whenNeeded: {
      type: String,
      enum: ["IMMEDIATE", "SCHEDULED"],
      required: true,
    },
    scheduleDate: {
      type: Date,
      required: function () {
        return this.whenNeeded === "SCHEDULED";
      },
    },
    isActive: {
      type: Boolean,
      default: function () {
        // If immediate, activate right away
        // If scheduled, activate only when schedule time is reached
        return this.whenNeeded === "IMMEDIATE";
      },
    },
    bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }], // Bids made by truckers
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 1 * 12 * 60 * 60 * 1000), // 12 hours from now
    },
  },
  { timestamps: true }
);

// Create 2dsphere indexes for geospatial queries on both source and destination
loadPostSchema.index({ source: "2dsphere" });
loadPostSchema.index({ destination: "2dsphere" });

// Middleware to validate coordinates before saving
loadPostSchema.pre("save", function (next) {
  // Validate source coordinates
  if (this.source.coordinates.length !== 2) {
    next(
      new Error(
        "Source location must have exactly 2 coordinates [longitude, latitude]"
      )
    );
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
    next(
      new Error(
        "Destination location must have exactly 2 coordinates [longitude, latitude]"
      )
    );
  }

  const [destLongitude, destLatitude] = this.destination.coordinates;

  if (destLongitude < -180 || destLongitude > 180) {
    next(new Error("Destination longitude must be between -180 and 180"));
  }

  if (destLatitude < -90 || destLatitude > 90) {
    next(new Error("Destination latitude must be between -90 and 90"));
  }

  if (this.whenNeeded === "SCHEDULED" && this.scheduleDate) {
    // Set isActive based on whether schedule time has been reached
    this.isActive = new Date() >= new Date(this.scheduleDate);

    // Set expiresAt to 12 hours after the schedule time
    this.expiresAt = new Date(
      new Date(this.scheduleDate).getTime() + 12 * 60 * 60 * 1000
    );
  }

  next();
});

module.exports = mongoose.model("LoadPost", loadPostSchema);
