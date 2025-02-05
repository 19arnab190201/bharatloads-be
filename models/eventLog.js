const mongoose = require("mongoose");

const eventLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["TRUCK", "USER", "LOAD_POST", "BID"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },
    event: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Create indexes for better query performance
eventLogSchema.index({ entityType: 1, entityId: 1 });
eventLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EventLog", eventLogSchema);
