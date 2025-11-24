import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ThemeContext } from "../../context/ThemeContext";
import { getSocket } from "../../utils/socket";

// Detailed view of all notifications shown under the header bell
const ImportantNotices = ({ notifications: propNotifications }) => {
  const { theme } = useContext(ThemeContext);
  const [notifications, setNotifications] = useState(propNotifications || []);
  const [loading, setLoading] = useState(!propNotifications);
  const [error, setError] = useState("");

  const fetchNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        "http://localhost:5000/api/notifications/mine"
      );
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notices. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!propNotifications) fetchNotifications();

    let socket;
    try {
      socket = getSocket();
      const handleNewNotification = (notif) => {
        setNotifications((prev) => [notif, ...(prev || [])]);
      };
      socket.on("notification:new", handleNewNotification);

      return () => {
        socket.off("notification:new", handleNewNotification);
      };
    } catch (_e) {
      // ignore socket errors
    }
  }, [propNotifications]);

  const containerStyle = useMemo(
    () =>
      `p-6 md:p-8 rounded-xl shadow-lg max-w-5xl mx-auto ${
        theme === "dark" ? "bg-slate-800" : "bg-white"
      }`,
    [theme]
  );

  const titleStyle = useMemo(
    () =>
      `text-2xl font-bold mb-6 border-b pb-3 ${
        theme === "dark" ? "text-gray-100 border-slate-700" : "text-gray-800 border-gray-200"
      }`,
    [theme]
  );

  const metaText = theme === "dark" ? "text-gray-400" : "text-gray-500";
  const primaryText = theme === "dark" ? "text-gray-100" : "text-gray-900";
  const cardBase =
    "relative border rounded-lg p-4 transition-colors focus-within:ring-2 focus-within:ring-offset-2";
  const cardTheme =
    theme === "dark"
      ? "bg-slate-700 border-slate-600 hover:bg-slate-650 focus-within:ring-teal-500 focus-within:ring-offset-slate-800"
      : "bg-gray-50 border-gray-200 hover:bg-gray-100 focus-within:ring-blue-500 focus-within:ring-offset-white";
  const accentBar = theme === "dark" ? "bg-teal-500" : "bg-blue-600";

  return (
    <div className={containerStyle}>
      <div className="flex items-center justify-between gap-4">
        <h2 className={titleStyle}>📢 Important Notices</h2>
        <button
          onClick={fetchNotifications}
          disabled={loading}
          className={`h-9 px-4 rounded-md text-sm font-medium shadow ${
            theme === "dark"
              ? "bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          }`}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            theme === "dark"
              ? "bg-red-900 bg-opacity-30 text-red-300"
              : "bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div
            className={`animate-spin rounded-full h-10 w-10 border-2 border-b-transparent ${
              theme === "dark" ? "border-teal-400" : "border-blue-600"
            }`}
          />
        </div>
      ) : notifications && notifications.length > 0 ? (
        <ul className={`divide-y ${theme === "dark" ? "divide-slate-600" : "divide-gray-200"}`}>
          {notifications.map((n) => (
            <li key={n._id || n.id || `${n.title}-${n.createdAt}`} className="py-3">
              <div className={`${cardBase} ${cardTheme}`}>
                <div className={`absolute left-0 top-0 h-full w-1 rounded-l ${accentBar}`} />
                <div className="ml-3">
                  <div className={`text-base font-semibold ${primaryText}`}>{n.title || "Notification"}</div>
                  {n.body && (
                    <p className={`mt-1 text-sm leading-6 ${metaText}`}>{n.body}</p>
                  )}
                  <div className={`mt-2 text-xs ${metaText}`}>
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className={`text-center py-16 rounded-lg ${
            theme === "dark" ? "bg-slate-700 text-gray-300" : "bg-gray-50 text-gray-600"
          }`}
        >
          No new notices 🎉
        </div>
      )}
    </div>
  );
};

export default ImportantNotices;