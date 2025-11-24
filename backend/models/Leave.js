import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    hr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    leaveType: {
      type: String,
      enum: [
        "Annual",
        "Sick",
        "Casual",
        "Unpaid",
        "Maternity/Paternity",
        "Other",
      ],
      default: "Annual",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    contactDuringLeave: { type: String },
    attachment: { type: String }, // optional file path or URL
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    hrComment: { type: String },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Leave", leaveSchema);