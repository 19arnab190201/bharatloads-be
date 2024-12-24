const BidSchema = new mongoose.Schema(
  {
    bidType: {
      type: String,
      enum: ["LOAD_BID", "TRUCK_REQUEST"], // LOAD_BID: Bid on a load by TRUCKERS, TRUCK_REQUEST: Request for a truck
      required: true,
    },
    loadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Load",
      required: true,
    },
    truckerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Truck",
    },
    offeredAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },

    // Custom bid fields
    materialType: { type: String },
    weight: { type: Number },
    priceQuote: { type: Number },
    source: { type: String },
    destination: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bid", BidSchema);
