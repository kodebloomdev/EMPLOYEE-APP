import { useState, useEffect, useRef, useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faBars } from "@fortawesome/free-solid-svg-icons";
import { FaSun, FaMoon, FaSignOutAlt, FaUser } from "react-icons/fa";
import { useNavigate, NavLink } from "react-router-dom";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";
import { getSocket } from "../utils/socket";
import kbLogo from "../assets/kb_logo.png";

const Header = ({ toggleSidebar }) => {
  const [lastLoginTime, setLastLoginTime] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [user, setUser] = useState({ name: "", role: "" });
  const [notifications, setNotifications] = useState([]); // message summaries
  const [noticeNotifications, setNoticeNotifications] = useState([]); // important notices
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  // Theme context
  const { theme, toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    const now = new Date();
    setLastLoginTime(
      now.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    );

    const storedUser = JSON.parse(localStorage.getItem("users"));
    if (storedUser) setUser({ name: storedUser.name, role: storedUser.role });
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications)
      document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  const clearNotifications = () => {
    setNotificationCount(0);
    setNotifications([]);
    setNoticeNotifications([]);
    setShowNotifications(false);
  };

  // Fetch unread message summary for logged-in user
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/messages/unread-summary"
        );
        const data = res.data || {};
        setNotifications(data.items || []);

        // Fetch important notices for this user
        let noticesCount = 0;
        try {
          const noticesRes = await axios.get(
            "http://localhost:5000/api/notifications/mine"
          );
          const notices = Array.isArray(noticesRes.data)
            ? noticesRes.data
            : [];
          setNoticeNotifications(notices);
          noticesCount = notices.length;
        } catch (notifErr) {
          console.error("Error fetching user notifications:", notifErr);
        }

        setNotificationCount((data.totalUnread || 0) + noticesCount);
      } catch (err) {
        console.error("Error fetching message unread summary:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUnread();

    // Subscribe to socket events to keep counts real-time
    let socket;
    try {
      socket = getSocket();
      const handleUpdate = () => {
        fetchUnread();
      };
      socket.on("conversation:updated", handleUpdate);
      socket.on("message:new", handleUpdate);

      const handleNewNotification = (notif) => {
        setNoticeNotifications((prev) => [notif, ...(prev || [])]);
        setNotificationCount((prev) => prev + 1);
      };
      socket.on("notification:new", handleNewNotification);

      return () => {
        socket.off("conversation:updated", handleUpdate);
        socket.off("message:new", handleUpdate);
        socket.off("notification:new", handleNewNotification);
      };
    } catch (_e) {
      // ignore socket errors in header
    }
  }, []);

  // Logout handler (taken from your code)
  const handleLogout = () => {
    localStorage.removeItem("users");
    navigate("/");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 px-6 flex items-center justify-between shadow-lg transition-colors duration-300
        ${theme === "dark"
          ? "bg-slate-900 text-gray-100"
          : "bg-gradient-to-r from-blue-900 via-blue-900 to-blue-900 text-white"}`}
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          className="menu-toggle md:hidden text-white text-2xl"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div className="logo w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-md bg-white">
          <img
            src={kbLogo}
            alt="KodeBloom Logo"
            className="object-contain w-10 h-10"
          />
        </div>

        <div className="company-name leading-tight">
          <h1 className="text-xl font-bold">KodeBloom</h1>
          <p className="text-xs opacity-90">Technology and Services Pvt. Ltd.</p>
        </div>
      </div>

      {/* Right Section */}
      <div className="header-right flex items-center gap-5">
        <div
          className={`login-time py-1 px-4 rounded-full text-sm shadow-md hidden md:block ${
            theme === "dark" ? "bg-slate-800 text-gray-200" : "bg-blue-900 text-white"
          }`}
        >
          Last login: <span className="font-medium">{lastLoginTime}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className={`p-2 rounded-full transition-colors ${
            theme === "dark" ? "bg-slate-800 text-yellow-300" : "bg-white text-gray-700"
          }`}
        >
          {theme === "dark" ? <FaSun /> : <FaMoon />}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            className="text-white p-2 rounded-full hover:bg-blue-900 transition-colors relative"
            onClick={() => {
              setShowNotifications((s) => !s);
              // close profile menu if open
              setShowProfileMenu(false);
            }}
            aria-label="Notifications"
          >
            <FontAwesomeIcon icon={faBell} className="text-xl text-white" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50">
              <div className="p-3 bg-blue-900 text-white font-bold flex justify-between items-center">
                <span>Notifications ({notificationCount})</span>
                <button
                  onClick={clearNotifications}
                  className="text-xs bg-blue-900 hover:bg-blue-800 px-2 py-1 rounded"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {notifications.length === 0 &&
                  noticeNotifications.length === 0 &&
                  !loading && (
                    <div className="p-3 text-sm text-gray-500">
                      No unread messages or notices.
                    </div>
                  )}
                {notifications.map((n) => (
                  <button
                    key={n.conversationId}
                    onClick={() => {
                      // Navigate to role-specific messenger for this conversation
                      if (user.role === "employee") {
                        navigate("/employee/messenger", {
                          state: { conversationId: n.conversationId },
                        });
                      } else if (user.role === "project managers") {
                        navigate("/pm/messages", {
                          state: { conversationId: n.conversationId },
                        });
                      } else if (user.role === "hr") {
                        navigate("/hr/messages", {
                          state: { conversationId: n.conversationId },
                        });
                      } else if (user.role === "director") {
                        navigate("/director/messages", {
                          state: { conversationId: n.conversationId },
                        });
                      }
                    }}
                    className="w-full text-left border-b border-gray-100 last:border-b-0 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="text-gray-800 font-semibold">
                      Unread message from {n.lastMessageFrom?.name || "Unknown"}
                    </p>
                    <p className="text-gray-600 text-sm mt-1 truncate">
                      {n.lastMessage}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {n.lastMessageAt
                        ? new Date(n.lastMessageAt).toLocaleString()
                        : ""}
                    </p>
                  </button>
                ))}

                {noticeNotifications.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                      Important Notices
                    </div>
                    {noticeNotifications.map((n) => (
                      <button
                        key={n._id}
                        onClick={() => {
                          if (user.role === "employee") {
                            navigate("/employee/important-notice");
                          }
                          setShowNotifications(false);
                        }}
                        className="w-full text-left border-b border-gray-100 last:border-b-0 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <p className="text-gray-800 font-semibold">
                          {n.title || "Notification"}
                        </p>
                        {n.body && (
                          <p className="text-gray-600 text-sm mt-1 truncate">
                            {n.body}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {n.createdAt
                            ? new Date(n.createdAt).toLocaleString()
                            : ""}
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div className="p-2 text-center bg-gray-100">
                <button className="text-blue-900 text-sm hover:text-blue-900">
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile (click to open profile menu) */}
        <div className="relative" ref={profileRef}>
          <button
            className="user-profile flex items-center gap-3 focus:outline-none"
            onClick={() => {
              setShowProfileMenu((s) => !s);
              // close notifications if open
              setShowNotifications(false);
            }}
            aria-haspopup="menu"
            aria-expanded={showProfileMenu}
            title="User menu"
          >
            <div className="profile-img w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow">
              {user.name ? user.name.split(" ").map((n) => n[0]).join("") : "JD"}
            </div>
            <div className="font-medium hidden md:block">
              {user.name} ({user.role})
            </div>
          </button>

          {showProfileMenu && (
            <div
              className="absolute right-0 mt-2 w-44 bg-white rounded-md shadow-lg overflow-hidden z-50"
              role="menu"
              aria-label="User menu"
            >
              <div className="p-3 border-b">
                <div className="font-semibold text-gray-800">{user.name || "John Doe"}</div>
                <div className="text-xs text-gray-500">{user.role || "Employee"}</div>
              </div>

              <div className="flex flex-col">
                <NavLink
                  to={user.role && user.role.toLowerCase() === "employee" ? "/employee/my-profile" : "/profile"}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <FaUser className="w-4 h-4" />
                  <span>Profile</span>
                </NavLink>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FaSignOutAlt className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;