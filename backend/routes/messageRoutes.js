import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Employee from "../models/Employee.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// --- Role / permission helpers -------------------------------------------------

const normalizeRole = (role) => (role || "").toLowerCase();

/**
 * Check if `fromEmp` is allowed to send a message to `toEmp` according
 * to the business rules described in the requirements.
 */
const canMessage = (fromEmp, toEmp) => {
  if (!fromEmp || !toEmp) return false;

  const fromId = fromEmp._id.toString();
  const toId = toEmp._id.toString();
  if (fromId === toId) return false; // no self-chat

  const fromRole = normalizeRole(fromEmp.role);
  const toRole = normalizeRole(toEmp.role);

  // Directors: can send and receive messages from HR, PM, and Employees.
  if (fromRole === "director") {
    return ["hr", "project managers", "employee"].includes(toRole);
  }

  // HR & PM: can send and receive messages with Director and with their assigned Employees.
  if (fromRole === "hr") {
    if (toRole === "director") return true;
    if (toRole === "employee") {
      return (
        toEmp.assignedHr && toEmp.assignedHr.toString() === fromId
      );
    }
    return false;
  }

  if (fromRole === "project managers") {
    if (toRole === "director") return true;
    if (toRole === "employee") {
      return (
        toEmp.assignedPm && toEmp.assignedPm.toString() === fromId
      );
    }
    return false;
  }

  // Employees: can send and receive messages only with their assigned HR/PM and the Director.
  if (fromRole === "employee") {
    if (toRole === "director") return true;
    if (toRole === "hr") {
      return (
        fromEmp.assignedHr && fromEmp.assignedHr.toString() === toId
      );
    }
    if (toRole === "project managers") {
      return (
        fromEmp.assignedPm && fromEmp.assignedPm.toString() === toId
      );
    }
    return false;
  }

  return false;
};

// Helper: find or create 1:1 conversation between two employees
const getOrCreateConversation = async (aId, bId) => {
  const a = aId.toString();
  const b = bId.toString();

  let convo = await Conversation.findOne({
    participants: { $all: [a, b] },
  });

  if (!convo) {
    convo = await Conversation.create({
      participants: [a, b],
      lastMessageAt: new Date(),
      unreadCounts: { [a]: 0, [b]: 0 },
    });
  }

  return convo;
};

// Sanitize message text (very basic XSS protection)
const sanitizeText = (text) => {
  if (typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001F]/g, "").trim();
};

// Simple in-memory rate limiting: max 30 messages per minute per user
const sendRateState = new Map();
const canSendMessageRate = (employeeId) => {
  const key = employeeId.toString();
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxCount = 30;

  let entry = sendRateState.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  if (entry.count >= maxCount) {
    return false;
  }

  entry.count += 1;
  sendRateState.set(key, entry);
  return true;
};

// POST /api/messages  -> send a new 1:1 message
router.post("/", auth, async (req, res) => {
  try {
    const fromEmployeeId = req.user.employeeId; // from JWT
    const { toEmployeeId, content, text } = req.body;

    if (!fromEmployeeId || !toEmployeeId) {
      return res.status(400).json({ message: "Missing sender or recipient" });
    }

    if (!canSendMessageRate(fromEmployeeId)) {
      return res
        .status(429)
        .json({ message: "Rate limit exceeded. Please slow down." });
    }

    const [fromEmp, toEmp] = await Promise.all([
      Employee.findById(fromEmployeeId),
      Employee.findById(toEmployeeId),
    ]);

    if (!fromEmp || !toEmp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 🔒 Role- and assignment-based permission check
    if (!canMessage(fromEmp, toEmp)) {
      return res.status(403).json({
        message:
          "You are not allowed to message this user based on role and assignment rules.",
      });
    }

    const cleanText = sanitizeText(text || content || "");
    if (!cleanText) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const conversation = await getOrCreateConversation(
      fromEmployeeId,
      toEmployeeId
    );

    const message = await Message.create({
      conversation: conversation._id,
      from: fromEmployeeId,
      to: toEmployeeId,
      text: cleanText,
      delivered: true, // stored and ready to emit
      seen: false,
    });

    // Update conversation metadata + unread counts
    const now = new Date();
    const unreadCounts = conversation.unreadCounts || new Map();
    const fromKey = fromEmployeeId.toString();
    const toKey = toEmployeeId.toString();

    unreadCounts.set(fromKey, 0);
    unreadCounts.set(toKey, (unreadCounts.get(toKey) || 0) + 1);

    conversation.lastMessageAt = now;
    conversation.lastMessageText = cleanText;
    conversation.lastMessageFrom = fromEmployeeId;
    conversation.unreadCounts = unreadCounts;
    await conversation.save();

    // Emit real-time updates via Socket.IO (io attached to app)
    const io = req.app.get("io");
    if (io) {
      const payload = {
        _id: message._id,
        conversationId: conversation._id,
        from: fromEmployeeId,
        to: toEmployeeId,
        text: cleanText,
        delivered: message.delivered,
        seen: message.seen,
        createdAt: message.createdAt,
      };

      // Emit to recipient room
      io.to(`user:${toKey}`).emit("message:new", payload);

      // Emit conversation update for both participants (for contact lists / badges)
      const convoSummary = {
        conversationId: conversation._id,
        lastMessageText: cleanText,
        lastMessageAt: conversation.lastMessageAt,
        lastMessageFrom: fromEmployeeId,
        unreadCounts: Object.fromEntries(unreadCounts),
      };

      io.to(`user:${fromKey}`).emit("conversation:updated", convoSummary);
      io.to(`user:${toKey}`).emit("conversation:updated", convoSummary);
    }

    res.status(201).json({
      message: "Message sent",
      data: message,
      conversationId: conversation._id,
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/messages/contacts -> list all conversations for logged in user
router.get("/contacts", auth, async (req, res) => {
  try {
    const meId = req.user.employeeId;
    if (!meId) return res.status(400).json({ message: "No employee id" });

    const me = await Employee.findById(meId);
    if (!me) return res.status(404).json({ message: "Employee not found" });

    const convos = await Conversation.find({
      participants: meId,
    })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name role assignedHr assignedPm");

    const meKey = meId.toString();

    const result = convos
      .map((c) => {
        const other = c.participants.find(
          (p) => p && p._id && p._id.toString() !== meKey
        );
        if (!other) return null;

        // Enforce role-based chat visibility as well
        if (!canMessage(me, other) && !canMessage(other, me)) {
          return null;
        }

        return {
          conversationId: c._id,
          otherEmployeeId: other._id,
          otherName: other.name || "Unknown",
          otherRole: other.role || "employee",
          lastMessage: c.lastMessageText || "",
          lastMessageAt: c.lastMessageAt,
          unreadCount: (c.unreadCounts && c.unreadCounts.get(meKey)) || 0,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/messages/thread/:conversationId -> full messages for a conversation
router.get("/thread/:conversationId", auth, async (req, res) => {
  try {
    const meId = req.user.employeeId?.toString();
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.some((p) => p.toString() === meId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const otherId = convo.participants.find((p) => p.toString() !== meId);

    const [me, other] = await Promise.all([
      Employee.findById(meId),
      otherId ? Employee.findById(otherId) : null,
    ]);

    if (!me || !other || (!canMessage(me, other) && !canMessage(other, me))) {
      return res.status(403).json({
        message: "You are not allowed to view this conversation.",
      });
    }

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate("from to", "name role");

    res.json(messages);
  } catch (err) {
    console.error("Error fetching thread:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/messages/:conversationId/mark-seen -> mark all received messages as seen
router.post("/:conversationId/mark-seen", auth, async (req, res) => {
  try {
    const meId = req.user.employeeId?.toString();
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.some((p) => p.toString() === meId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const otherId = convo.participants.find((p) => p.toString() !== meId);

    const [me, other] = await Promise.all([
      Employee.findById(meId),
      otherId ? Employee.findById(otherId) : null,
    ]);

    if (!me || !other || (!canMessage(me, other) && !canMessage(other, me))) {
      return res.status(403).json({
        message: "You are not allowed to modify this conversation.",
      });
    }

    await Message.updateMany(
      { conversation: conversationId, to: meId, seen: false },
      { $set: { seen: true } }
    );

    const unreadCounts = convo.unreadCounts || new Map();
    unreadCounts.set(meId, 0);
    convo.unreadCounts = unreadCounts;
    await convo.save();

    const io = req.app.get("io");
    if (io) {
      const payload = {
        conversationId: convo._id,
        seenBy: meId,
      };

      io.to(`user:${otherId.toString()}`).emit("message:seen", payload);
      io.to(`user:${meId}`).emit("conversation:updated", {
        conversationId: convo._id,
        lastMessageText: convo.lastMessageText,
        lastMessageAt: convo.lastMessageAt,
        lastMessageFrom: convo.lastMessageFrom,
        unreadCounts: Object.fromEntries(unreadCounts),
      });
    }

    res.json({ message: "Messages marked as seen" });
  } catch (err) {
    console.error("Error marking messages seen:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/messages/unread-summary -> header + badges
router.get("/unread-summary", auth, async (req, res) => {
  try {
    const meId = req.user.employeeId?.toString();
    if (!meId) return res.status(400).json({ message: "No employee id" });

    const me = await Employee.findById(meId);
    if (!me) return res.status(404).json({ message: "Employee not found" });

    const convos = await Conversation.find({ participants: meId })
      .select("unreadCounts lastMessageAt lastMessageText participants lastMessageFrom")
      .populate("lastMessageFrom", "name role")
      .populate("participants", "role assignedHr assignedPm");

    let total = 0;
    const items = [];

    for (const c of convos) {
      const other = c.participants.find((p) => p && p._id.toString() !== meId);
      if (!other) continue;

      // Skip conversations not allowed by role rules
      if (!canMessage(me, other) && !canMessage(other, me)) {
        continue;
      }

      const meUnread = (c.unreadCounts && c.unreadCounts.get(meId)) || 0;
      if (!meUnread) continue;
      total += meUnread;

      items.push({
        conversationId: c._id,
        unreadCount: meUnread,
        lastMessage: c.lastMessageText,
        lastMessageAt: c.lastMessageAt,
        lastMessageFrom: c.lastMessageFrom,
      });
    }

    items.sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

    res.json({ totalUnread: total, items });
  } catch (err) {
    console.error("Error fetching unread summary:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;