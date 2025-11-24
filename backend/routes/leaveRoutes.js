import express from "express";
import { auth, permit } from "../middleware/auth.js";
import {
  applyLeave,
  getMyLeaves,
  getHrPendingLeaves,
  updateLeaveStatus,
} from "../controllers/leaveController.js";

const router = express.Router();

// Employee applies for leave
router.post("/", auth, permit("employee"), applyLeave);

// Employee views own leaves
router.get("/my", auth, permit("employee"), getMyLeaves);

// HR views pending leaves
router.get("/hr/pending", auth, permit("hr"), getHrPendingLeaves);

// HR approves/rejects a leave
router.patch("/:id/status", auth, permit("hr"), updateLeaveStatus);

export default router;