import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";

// Employee applies for leave
export const applyLeave = async (req, res) => {
  try {
    const { employeeId, role } = req.user || {};
    if (!employeeId || role !== "employee") {
      return res.status(403).json({ message: "Only employees can apply for leave" });
    }

    const { leaveType, startDate, endDate, reason, contactDuringLeave } = req.body;

    if (!startDate || !endDate || !reason) {
      return res
        .status(400)
        .json({ message: "startDate, endDate and reason are required" });
    }

    const employeeDoc = await Employee.findById(employeeId).populate(
      "assignedHr",
      "name email"
    );
    if (!employeeDoc) {
      return res.status(404).json({ message: "Employee not found" });
    }
    if (!employeeDoc.assignedHr) {
      return res
        .status(400)
        .json({ message: "No HR assigned to this employee" });
    }

    const leave = await Leave.create({
      employee: employeeDoc._id,
      hr: employeeDoc.assignedHr._id || employeeDoc.assignedHr,
      leaveType: leaveType || "Annual",
      startDate,
      endDate,
      reason,
      contactDuringLeave,
    });

    res.status(201).json({
      message: "Leave application submitted successfully.",
      leave,
    });
  } catch (error) {
    console.error("applyLeave error:", error);
    res.status(500).json({ message: "Error submitting leave application" });
  }
};

// Employee: list own leaves
export const getMyLeaves = async (req, res) => {
  try {
    const { employeeId, role } = req.user || {};
    if (!employeeId || role !== "employee") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const leaves = await Leave.find({ employee: employeeId })
      .sort({ createdAt: -1 })
      .populate("hr", "name email");

    res.json(leaves);
  } catch (error) {
    console.error("getMyLeaves error:", error);
    res.status(500).json({ message: "Error fetching leaves" });
  }
};

// HR: list pending leaves for employees assigned to this HR
export const getHrPendingLeaves = async (req, res) => {
  try {
    const { employeeId, role } = req.user || {};
    if (!employeeId || role !== "hr") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const leaves = await Leave.find({ hr: employeeId, status: "Pending" })
      .sort({ createdAt: -1 })
      .populate("employee", "name employeeId department");

    res.json(leaves);
  } catch (error) {
    console.error("getHrPendingLeaves error:", error);
    res.status(500).json({ message: "Error fetching pending leaves" });
  }
};

// HR: approve or reject a leave
export const updateLeaveStatus = async (req, res) => {
  try {
    const { employeeId, role } = req.user || {};
    if (!employeeId || role !== "hr") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id } = req.params;
    const { status, hrComment } = req.body;

    if (!status || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const leave = await Leave.findById(id).populate("employee", "name");
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if (leave.hr.toString() !== employeeId.toString()) {
      return res.status(403).json({ message: "Not authorized for this leave" });
    }

    leave.status = status;
    leave.hrComment = hrComment || leave.hrComment;
    leave.decidedAt = new Date();
    await leave.save();

    // Create notification for employee
    let notification = null;
    try {
      const title =
        status === "Approved" ? "Leave Approved" : "Leave Rejected";
      const body =
        status === "Approved"
          ? `Your ${leave.leaveType} leave from ${new Date(
              leave.startDate
            ).toLocaleDateString()} to ${new Date(
              leave.endDate
            ).toLocaleDateString()} has been approved.`
          : `Your ${leave.leaveType} leave from ${new Date(
              leave.startDate
            ).toLocaleDateString()} to ${new Date(
              leave.endDate
            ).toLocaleDateString()} has been rejected.`;

      notification = await Notification.create({
        to: leave.employee._id,
        title,
        body,
        data: {
          leaveId: leave._id,
          status: leave.status,
        },
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${leave.employee._id.toString()}`).emit(
          "notification:new",
          notification
        );
      }
    } catch (notifyErr) {
      console.error("Failed to create/emit notification for leave:", notifyErr);
    }

    res.json({ message: "Leave updated", leave });
  } catch (error) {
    console.error("updateLeaveStatus error:", error);
    res.status(500).json({ message: "Error updating leave" });
  }
};