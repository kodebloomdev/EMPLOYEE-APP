import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";
import { getSocket } from "../../utils/socket";

// Simple helper to format HH:MM am/pm
const formatTime = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Message bubble component
const MessageBubble = ({ text, time, sender, theme }) => {
  const isMe = sender === "me";
  const baseText = theme === "dark" ? "text-gray-100" : "text-gray-800";

  const bubbleClass = isMe
    ? theme === "dark"
      ? "bg-teal-600 text-white"
      : "bg-blue-600 text-white"
    : theme === "dark"
    ? "bg-slate-700 text-gray-100"
    : "bg-gray-100 text-gray-800";

  const timeClass = isMe
    ? "text-white/80"
    : theme === "dark"
    ? "text-gray-400"
    : "text-gray-500";

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-2 shadow ${bubbleClass}`}>
        <div className={`whitespace-pre-wrap break-words ${isMe ? "" : baseText}`}>{text}</div>
        <div className={`text-[10px] mt-1 ${timeClass}`}>{time}</div>
      </div>
    </div>
  );
};

const Messenger = () => {
  const { theme } = useContext(ThemeContext);
  const location = useLocation();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("users"));
    } catch {
      return null;
    }
  }, []);

  const meEmployeeId = user?.employeeId;
  const meName = user?.name || "You";

  const [contacts, setContacts] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(
    location.state?.conversationId || null
  );
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const endRef = useRef(null);

  // Helper to map message API object to UI bubble
  const mapMessageToBubble = useCallback(
    (m) => ({
      id: m._id || Date.now(),
      sender:
        m.from && m.from._id && meEmployeeId &&
        String(m.from._id) === String(meEmployeeId)
          ? "me"
          : m.sender || "other",
      text: m.text || m.content,
      time: m.createdAt ? formatTime(new Date(m.createdAt)) : formatTime(),
    }),
    [meEmployeeId]
  );

  // Load contacts (conversations + default HR/PM/Director contacts)
  const loadContacts = useCallback(async () => {
    if (!meEmployeeId) return;

    try {
      const [contactRes, meRes, allEmpRes] = await Promise.all([
        axios.get("http://localhost:5000/api/messages/contacts"),
        axios.get(`http://localhost:5000/api/employees/${meEmployeeId}`),
        axios.get("http://localhost:5000/api/employees"),
      ]);

      const fromServer = Array.isArray(contactRes.data) ? contactRes.data : [];

      const byOtherId = new Map();
      for (const c of fromServer) {
        if (!c.otherEmployeeId) continue;
        byOtherId.set(String(c.otherEmployeeId), { ...c });
      }

      const meEmp = meRes.data;
      const defaults = [];

      if (meEmp?.assignedHr?._id) {
        const id = String(meEmp.assignedHr._id);
        if (!byOtherId.has(id)) {
          defaults.push({
            conversationId: null,
            otherEmployeeId: meEmp.assignedHr._id,
            otherName: meEmp.assignedHr.name,
            otherRole: "hr",
            lastMessage: "",
            lastMessageAt: null,
            unreadCount: 0,
          });
        }
      }

      if (meEmp?.assignedPm?._id) {
        const id = String(meEmp.assignedPm._id);
        if (!byOtherId.has(id)) {
          defaults.push({
            conversationId: null,
            otherEmployeeId: meEmp.assignedPm._id,
            otherName: meEmp.assignedPm.name,
            otherRole: "project managers",
            lastMessage: "",
            lastMessageAt: null,
            unreadCount: 0,
          });
        }
      }

      const allEmployees = Array.isArray(allEmpRes.data) ? allEmpRes.data : [];
      const director = allEmployees.find((e) => e.role === "director");
      if (director?._id) {
        const id = String(director._id);
        if (!byOtherId.has(id)) {
          defaults.push({
            conversationId: null,
            otherEmployeeId: director._id,
            otherName: director.name,
            otherRole: "director",
            lastMessage: "",
            lastMessageAt: null,
            unreadCount: 0,
          });
        }
      }

      const merged = [...fromServer, ...defaults];
      merged.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setContacts(merged);

      // Selection rules:
      // 1) On first load (no active conversation and no active contact yet),
      //    default to the first contact if any.
      // 2) If we have an activeConversationId, re-bind activeContact from it.
      // 3) Otherwise, if we have an activeContact (user manually picked someone
      //    without an existing conversation yet), keep that selection based on
      //    otherEmployeeId so it doesn't jump back to the first contact.
      if (!activeConversationId && !activeContact && merged.length > 0) {
        setActiveConversationId(merged[0].conversationId || null);
        setActiveContact(merged[0]);
      } else if (activeConversationId) {
        const found = merged.find(
          (c) => String(c.conversationId) === String(activeConversationId)
        );
        if (found) setActiveContact(found);
      } else if (activeContact && activeContact.otherEmployeeId) {
        const foundByOther = merged.find(
          (c) =>
            c.otherEmployeeId &&
            String(c.otherEmployeeId) ===
              String(activeContact.otherEmployeeId)
        );
        if (foundByOther) setActiveContact(foundByOther);
      }
    } catch (err) {
      console.error("Error loading employee messenger contacts:", err);
      setError("Failed to load contacts.");
    }
  }, [meEmployeeId, activeConversationId]);

  // Initial load
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load messages when conversation changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `http://localhost:5000/api/messages/thread/${activeConversationId}`
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setMessages(list.map(mapMessageToBubble));

        // Mark as seen on open
        await axios.post(
          `http://localhost:5000/api/messages/${activeConversationId}/mark-seen`
        );
      } catch (err) {
        console.error("Error loading conversation:", err);
        setError("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeConversationId, mapMessageToBubble]);

  // Auto-scroll to bottom on new messages, but only inside the chat list container
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Socket listeners for realtime updates
  useEffect(() => {
    let socket;
    try {
      socket = getSocket();
      const handleNew = async (payload) => {
        if (!payload?.conversationId) return;

        // Refresh contacts
        loadContacts();

        if (
          activeConversationId &&
          String(payload.conversationId) === String(activeConversationId)
        ) {
          setMessages((prev) => [
            ...prev,
            mapMessageToBubble({ ...payload, from: { _id: payload.from } }),
          ]);

          if (
            meEmployeeId &&
            String(payload.to) === String(meEmployeeId)
          ) {
            try {
              await axios.post(
                `http://localhost:5000/api/messages/${payload.conversationId}/mark-seen`
              );
            } catch (_e) {}
          }
        }
      };

      const handleConvoUpdated = () => {
        loadContacts();
      };

      socket.on("message:new", handleNew);
      socket.on("conversation:updated", handleConvoUpdated);

      return () => {
        socket.off("message:new", handleNew);
        socket.off("conversation:updated", handleConvoUpdated);
      };
    } catch (_e) {
      // ignore socket errors in messenger
    }
  }, [activeConversationId, loadContacts, mapMessageToBubble, meEmployeeId]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !activeContact?.otherEmployeeId || !meEmployeeId) return;

    setSending(true);
    setError("");

    const optimistic = {
      id: Date.now(),
      sender: "me",
      text: trimmed,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await axios.post("http://localhost:5000/api/messages", {
        toEmployeeId: activeContact.otherEmployeeId,
        text: trimmed,
      });

      if (!activeConversationId && res.data?.conversationId) {
        setActiveConversationId(res.data.conversationId);
        setActiveContact((prev) =>
          prev
            ? { ...prev, conversationId: res.data.conversationId }
            : prev
        );
      }
    } catch (err) {
      console.error("Error sending employee message:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) sendMessage();
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              className={`text-xl font-bold tracking-wide ${
                theme === "dark" ? "text-gray-100" : "text-gray-800"
              }`}
            >
              Messenger
            </h2>
            <div
              className={`h-1 w-24 rounded mt-1 ${
                theme === "dark" ? "bg-teal-500" : "bg-blue-600"
              }`}
            />
            <p
              className={`mt-1 text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Chat with your HR, PM, and Director in real time.
            </p>
          </div>
        </div>

        {error && (
          <div
            className={`mb-3 text-xs rounded-md px-3 py-2 ${
              theme === "dark"
                ? "bg-red-900/50 text-red-200"
                : "bg-red-50 text-red-700"
            }`}
          >
            {error}
          </div>
        )}

        <div className="rounded-lg shadow-lg border overflow-hidden flex h-[70vh]">
          {/* Sidebar contact list */}
          <div
            className={`w-1/3 border-r overflow-y-auto ${
              theme === "dark"
                ? "bg-slate-900 border-slate-700"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            {contacts.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">
                No conversations yet. Start by messaging your HR, PM, or Director.
              </div>
            ) : (
              contacts.map((c) => {
                const isActive =
                  (activeContact &&
                    String(activeContact.otherEmployeeId) ===
                      String(c.otherEmployeeId)) ||
                  (!!activeConversationId &&
                    !!c.conversationId &&
                    String(activeConversationId) ===
                      String(c.conversationId));

                const baseBorder =
                  theme === "dark" ? "border-slate-800" : "border-gray-200";
                const hoverBg =
                  theme === "dark" ? "hover:bg-slate-800" : "hover:bg-gray-100";
                const activeBg =
                  theme === "dark" ? "bg-slate-800" : "bg-blue-50";

                return (
                  <button
                    key={c.otherEmployeeId}
                    onClick={async () => {
                      setActiveConversationId(c.conversationId || null);
                      setActiveContact(c);
                      setError("");
                      setMessages([]); // clear previous thread immediately

                      if (c.conversationId) {
                        try {
                          await axios.post(
                            `http://localhost:5000/api/messages/${c.conversationId}/mark-seen`
                          );
                        } catch (_e) {
                          // ignore mark-seen failures in client
                        }
                      }
                    }}
                    className={`w-full text-left px-3 py-2 flex flex-col border-b ${baseBorder} ${
                      isActive ? activeBg : hoverBg
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-sm font-medium ${
                          theme === "dark" ? "text-gray-100" : "text-gray-800"
                        }`}
                      >
                        {c.otherName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {c.lastMessageAt &&
                          formatTime(new Date(c.lastMessageAt))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-400 truncate max-w-[80%]">
                        {c.lastMessage ||
                          `Chat with your ${c.otherRole || "contact"}`}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Main chat area */}
          <div
            className={`flex-1 flex flex-col ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-200"
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                theme === "dark" ? "border-slate-700" : "border-gray-200"
              }`}
            >
              <div>
                <div
                  className={`${
                    theme === "dark" ? "text-gray-100" : "text-gray-800"
                  } text-sm font-medium`}
                >
                  {activeContact?.otherName || "Select a contact"}
                </div>
                <div
                  className={`${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  } text-xs`}
                >
                  {activeContact
                    ? `Chat with your ${activeContact.otherRole || "contact"}`
                    : "Choose someone to start chatting."}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className={`flex-1 overflow-y-auto p-4 space-y-3 ${
                theme === "dark" ? "bg-slate-800" : "bg-white"
              }`}
              style={{ scrollBehavior: "smooth" }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div
                  className={`text-xs text-center mt-10 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  No messages yet.
                </div>
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    text={m.text}
                    time={m.time}
                    sender={m.sender}
                    theme={theme}
                  />
                ))
              )}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sending) sendMessage();
              }}
              className={`px-3 py-3 border-t ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-800"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className={`flex-1 resize-none rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] max-h-36 ${
                    theme === "dark"
                      ? "bg-slate-700 text-gray-100 placeholder:text-gray-400 focus:ring-teal-500 focus:ring-offset-slate-900"
                      : "bg-white text-gray-800 placeholder:text-gray-400 focus:ring-blue-500 focus:ring-offset-gray-100"
                  }`}
                />
                <button
                  type="submit"
                  disabled={!activeContact?.otherEmployeeId || sending}
                  className={`h-[44px] px-4 rounded-md text-sm font-medium shadow transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    theme === "dark"
                      ? "bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 focus:ring-offset-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  }`}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messenger;