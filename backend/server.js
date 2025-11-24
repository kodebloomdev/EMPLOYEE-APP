import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cors from "cors";
import path from "path"; // ✅ Add this
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";


// Route imports
import authRoutes from "./routes/authRoutes.js";
import directorRoutes from "./routes/director.js";
import hrRoutes from "./routes/hr.js";
import pmRoutes from "./routes/pm.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import attendanceRoutes from "./routes/AttendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import { auth as authMiddleware } from "./middleware/auth.js";

// Models
import Notification from "./models/Notification.js";
import User from "./models/User.js";
import Employee from "./models/Employee.js";


dotenv.config();
await connectDB(); // ensure MongoDB connection before starting server

const app = express();
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

// ⚠️ Support big JSON payloads (for base64 images)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);

// ✅ Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/director", directorRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/pm", pmRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/projects", projectRoutes); // singular for employee-specific actions
app.use("/api/holidays", holidayRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/messages", messageRoutes);





// ✅ Create Notification
app.post("/api/notifications", async (req, res) => {
  console.log("POST /api/notifications hit", req.body);
  try {
    const { to, title, body, data } = req.body;

    const notification = new Notification({ to, title, body, data });
    await notification.save();

    try {
      const io = req.app.get("io");
      if (io && notification.to) {
        io.to(`user:${notification.to.toString()}`).emit(
          "notification:new",
          notification
        );
      }
    } catch (emitErr) {
      console.error("Error emitting notification via socket:", emitErr);
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Fetch all notifications (admin/debug)
app.get("/api/fetchnotifications", async (_req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Fetch notifications for logged-in employee
app.get("/api/notifications/mine", authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.user || {};
    if (!employeeId) {
      return res.status(400).json({ message: "Employee context missing" });
    }

    const notifications = await Notification.find({ to: employeeId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/fetchHr", async(req,res) => {
  try{
      const Hr = await Employee.find({role : "hr"})
      res.json(Hr);
  }
  catch(error){
    console.error("Error fetching Hrs", error);
    res.status(500).json({ message: "Server error" });
  }
})

app.get("/api/GetHr/:id", async(req,res) => {
  try{
      const {id} = req.params;
      const Hr = await Employee.findById(id);
      res.json(Hr);
  }
  catch(error){
    console.error("Error fetching Hrs", error);
    res.status(500).json({ message: "Server error" });
  }
})


app.get("/api/fetchPms", async(req,res) => {
  try{
      const Pm = await Employee.find({role : "project managers"})
      res.json(Pm);
  }
  catch(error){
    console.error("Error fetching Pms", error);
    res.status(500).json({ message: "Server error" });
  }
})


// ✅ Fetch employee details from notifications.data
app.get("/api/fetchEmployees", async (_req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });

 

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/notificationDelete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Backend received delete request for ID:", id); // 👈 add this
    const deleted = await Notification.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Error deleting notification", error });
  }
});



// ✅ Test route
app.get("/test", (_req, res) => res.send("API is working"));

// ❌ Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

// ✅ Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No auth token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    socket.user = decoded;
    return next();
  } catch (err) {
    return next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  const { employeeId, role } = socket.user || {};
  if (!employeeId) {
    socket.disconnect(true);
    return;
  }

  const room = `user:${employeeId.toString()}`;
  socket.join(room);
  console.log("Socket connected", room, "role:", role);

  socket.on("disconnect", () => {
    console.log("Socket disconnected", room);
  });
});

// Make io accessible in routes via req.app.get("io")
app.set("io", io);

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
