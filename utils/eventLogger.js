const EventLog = require("../models/eventLog");

class EventLogger {
  static async log(params) {
    const {
      entityType,
      entityId,
      event,
      description,
      performedBy,
      changes = null,
      metadata = null,
    } = params;

    try {
      const eventLog = await EventLog.create({
        entityType,
        entityId,
        event,
        description,
        performedBy,
        changes,
        metadata,
      });

      return eventLog;
    } catch (error) {
      console.error("Error logging event:", error);
      // Don't throw error to prevent disrupting main operation
    }
  }

  static async getEntityLogs(entityType, entityId, options = {}) {
    const { limit = 50, page = 1, sort = { createdAt: -1 } } = options;

    try {
      const logs = await EventLog.find({
        entityType,
        entityId,
      })
        .populate("performedBy", "name userType")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await EventLog.countDocuments({ entityType, entityId });

      return {
        logs,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error("Error fetching entity logs:", error);
      throw error;
    }
  }
}

// Event type constants
EventLogger.EVENTS = {
  TRUCK: {
    CREATED: "TRUCK_CREATED",
    UPDATED: "TRUCK_UPDATED",
    DELETED: "TRUCK_DELETED",
    REPOSTED: "TRUCK_REPOSTED",
    PAUSED: "TRUCK_PAUSED",
    RC_VERIFIED: "RC_VERIFIED",
  },
  LOAD: {
    CREATED: "LOAD_CREATED",
    UPDATED: "LOAD_UPDATED",
    DELETED: "LOAD_DELETED",
    REPOSTED: "LOAD_REPOSTED",
    PAUSED: "LOAD_PAUSED",
  },
  BID: {
    CREATED: "BID_CREATED",
    UPDATED: "BID_UPDATED",
    DELETED: "BID_DELETED",
    ACCEPTED: "BID_ACCEPTED",
    REJECTED: "BID_REJECTED",
  },
  USER: {
    CREATED: "USER_CREATED",
    UPDATED: "USER_UPDATED",
    VERIFIED: "USER_VERIFIED",
    LOGGED_IN: "USER_LOGGED_IN",
  },
};

module.exports = EventLogger;
