import React, { useState, useContext, useEffect } from "react";
import {
  FaHome,
  FaUserPlus,
  FaUsers,
  FaChartBar,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaBullhorn,
  FaPlaneDeparture,
  FaUserCog,
} from "react-icons/fa";

import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import axios from "axios";
import { getSocket } from "../utils/socket";

const Sidebar = ({
  isOpen = true,
  isCollapsed = false,
  toggleCollapse = () => {},
  activeKey = "dashboard", // kept for backwards compatibility if you use it externally
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = JSON.parse(localStorage.getItem("users"));
  const role = storedUser?.role || "Guest";
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [messageUnread, setMessageUnread] = useState(0);

  const sidebarBg = isDark ? "bg-slate-900 text-gray-300" : "bg-white text-gray-700";
  const titleColor = isDark ? "text-gray-400" : "text-gray-500";

  // small helper to produce consistent item container classes
  const itemClass = (active) =>
    `flex items-center gap-3 px-5 py-3 transition-all duration-200 border-l-4
     ${
       active
         ? isDark
           ? "bg-slate-800 border-blue-400 text-blue-300"
           : "bg-blue-50 border-blue-600 text-blue-700"
         : isDark
         ? "border-transparent hover:bg-slate-800 hover:border-blue-400 hover:text-blue-300"
         : "border-transparent hover:bg-gray-100 hover:border-blue-600 hover:text-blue-700"
     } whitespace-nowrap`;

  const Title = ({ children }) => (
    <div
      className={`px-5 pt-4 pb-2 text-[11px] uppercase tracking-[0.08em] ${
        isCollapsed ? "hidden" : "block"
      } ${titleColor}`}
    >
      {children}
    </div>
  );

  const handleLogout = () => {
    localStorage.removeItem("users");
    navigate("/");
  };

  // Use this component to render icon + label items.
  // It accepts active boolean so parent can control active styling.
  const Item = ({ icon: Icon, label, active, badge }) => (
    <div className={itemClass(active)}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && (
        <span
          className={`menu-text flex-1 flex justify-between items-center ${
            active ? "font-semibold" : ""
          }`}
        >
          <span>{label}</span>
          {badge > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-green-500 text-white text-[10px]">
              {badge}
            </span>
          )}
        </span>
      )}
    </div>
  );

  // HR submenu open state; auto open when current path is a HR sub-route
  const [openEmployeeMgmt, setOpenEmployeeMgmt] = useState(false);
  useEffect(() => {
    // open if current location matches any hr menu routes
    if (location.pathname.startsWith("/hr")) {
      setOpenEmployeeMgmt(true);
    }
  }, [location.pathname]);

  // Messenger unread count for sidebar badge
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/messages/unread-summary"
        );
        const data = res.data || {};
        setMessageUnread(data.totalUnread || 0);
      } catch (err) {
        console.error("Error fetching sidebar unread summary:", err);
      }
    };

    fetchUnread();

    let socket;
    try {
      socket = getSocket();
      const handleUpdate = () => {
        fetchUnread();
      };
      socket.on("conversation:updated", handleUpdate);
      socket.on("message:new", handleUpdate);

      return () => {
        socket.off("conversation:updated", handleUpdate);
        socket.off("message:new", handleUpdate);
      };
    } catch (_e) {
      // ignore socket setup errors
    }
  }, []);

  return (
    <aside
      className={`h-screen shadow-[2px_0_10px_rgba(0,0,0,0.05)] transition-all duration-300 ease-in-out
      ${isCollapsed ? "w-16" : "w-64"} hidden md:flex flex-col fixed top-0 left-0 ${sidebarBg}`}
    >
      {/* Main navigation title (single place) */}
      <Title>Main Navigation</Title>

      {/* ---------- MAIN section ---------- */}
      <div className="mt-2">
        <Title>MAIN</Title>

        {/* Dashboard route differs by role; highlight via NavLink's isActive */}
        {role === "director" && (
          <NavLink to="/director/dashboard" className="w-full text-left">
            {({ isActive }) => <Item icon={FaHome} label="Dashboard" active={isActive} />}
          </NavLink>
        )}

        {role === "hr" && (
          <NavLink to="/hr" className="w-full text-left">
            {({ isActive }) => <Item icon={FaHome} label="Dashboard" active={isActive} />}
          </NavLink>
        )}

      </div>

      {/* ---------- DIRECTOR ---------- */}
      {role === "director" && (
        <>
          <NavLink to="/director/messages" className="w-full text-left">
            {({ isActive }) => (
              <Item
                icon={FaBullhorn}
                label="Messenger"
                active={isActive}
                badge={messageUnread}
              />
            )}
          </NavLink>
          <NavLink to="/director/announcement" className="w-full text-left">
            {({ isActive }) => (
              <Item icon={FaBullhorn} label="Announcement" active={isActive} />
            )}
          </NavLink>

          <Title>MANAGEMENT</Title>

          <NavLink to="/director/create-employee" className="w-full text-left">
            {({ isActive }) => <Item icon={FaUserPlus} label="Create Employee" active={isActive} />}
          </NavLink>

          <NavLink to="/director/hr-credentials" className="w-full text-left">
            {({ isActive }) => (
              <Item icon={FaUserPlus} label="Create HR Credentials" active={isActive} />
            )}
          </NavLink>

          <NavLink to="/director/project-overview" className="w-full text-left">
            {({ isActive }) => <Item icon={FaChartBar} label="Project Overview" active={isActive} />}
          </NavLink>

          <NavLink to="/director/report" className="w-full text-left">
            {({ isActive }) => <Item icon={FaChartBar} label="Report & Analytics" active={isActive} />}
          </NavLink>

          <Title>COMPANY</Title>

          <NavLink to="/director/holiday" className="w-full text-left">
            {({ isActive }) => <Item icon={FaPlaneDeparture} label="Holiday List" active={isActive} />}
          </NavLink>

          <NavLink to="/director/notice" className="w-full text-left">
            {({ isActive }) => <Item icon={FaBullhorn} label="Important Notice" active={isActive} />}
          </NavLink>

          <NavLink to="/director/account" className="w-full text-left">
            {({ isActive }) => <Item icon={FaBullhorn} label="Account Settings" active={isActive} />}
          </NavLink>
        </>
      )}

      {/* ---------- HR ---------- */}
      {role === "hr" && (
        <>
          <NavLink to="/hr/messages" className="w-full text-left">
            {({ isActive }) => (
              <Item
                icon={FaBullhorn}
                label="Messenger"
                active={isActive}
                badge={messageUnread}
              />
            )}
          </NavLink>

          <Title>EMPLOYEE MANAGEMENT</Title>

          {/* Collapsible header (button) */}
          <button
            onClick={() => setOpenEmployeeMgmt((s) => !s)}
            aria-expanded={openEmployeeMgmt}
            className={`w-full flex items-center justify-between px-5 py-3 transition-all duration-200
              ${
                isCollapsed
                  ? "justify-center"
                  : isDark
                  ? "text-gray-300 hover:bg-slate-800"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <div className="flex items-center gap-3">
              <FaUserCog className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>Employee Management</span>}
            </div>

            {!isCollapsed && (
              <span
                className={`transform transition-transform duration-300 ${
                  openEmployeeMgmt ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden
              >
                ▼
              </span>
            )}
          </button>

          {/* Sub-items — bullets + NavLinks using NavLink isActive to set active state */}
          {openEmployeeMgmt && !isCollapsed && (
            <div className="ml-8 mt-2 space-y-2">
              <NavLink to="/hr/add-credentials" className="block">
                {({ isActive }) => (
                  <div className={`text-sm flex items-center gap-2 px-1 py-1 ${isActive ? "text-blue-700 font-medium" : isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="mr-2">•</span>
                    <span>Create Credentials</span>
                  </div>
                )}
              </NavLink>

              <NavLink to="/hr/manage-employee" className="block">
                {({ isActive }) => (
                  <div className={`text-sm flex items-center gap-2 px-1 py-1 ${isActive ? "text-blue-700 font-medium" : isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="mr-2">•</span>
                    <span>Manage Employees</span>
                  </div>
                )}
              </NavLink>

              <NavLink to="/hr/employee-records" className="block">
                {({ isActive }) => (
                  <div className={`text-sm flex items-center gap-2 px-1 py-1 ${isActive ? "text-blue-700 font-medium" : isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <span className="mr-2">•</span>
                    <span>View Employee List</span>
                  </div>
                )}
              </NavLink>
            </div>
          )}

          {/* Collapsed mode: show icon-only quick links so navigation still works */}
          {isCollapsed && (
            <div className="flex flex-col items-center mt-2 space-y-2">
              <NavLink to="/hr/create-credentials" className="w-full text-center">
                <div className="p-2 rounded hover:bg-gray-200">
                  <FaUserPlus className="w-5 h-5" />
                </div>
              </NavLink>
              <NavLink to="/hr/manage-employees" className="w-full text-center">
                <div className="p-2 rounded hover:bg-gray-200">
                  <FaUsers className="w-5 h-5" />
                </div>
              </NavLink>
              <NavLink to="/hr/employee-list" className="w-full text-center">
                <div className="p-2 rounded hover:bg-gray-200">
                  <FaUsers className="w-5 h-5" />
                </div>
              </NavLink>
            </div>
          )}

          {/* Recruitment and Attendance sections (as in screenshot) */}
          <div className="mt-4">
            <NavLink to="/hr/recruitment" className="w-full text-left">
              {({ isActive }) => (
                <div className={`w-full flex items-center justify-between px-5 py-3 ${isActive ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600" : isDark ? "text-gray-300 hover:bg-slate-800" : "text-gray-700 hover:bg-gray-100"}`}>
                  <div className="flex items-center gap-2">
                    <FaUsers className="w-4 h-4" />
                    {!isCollapsed && <span>Recruitment</span>}
                  </div>
                  {!isCollapsed && <span>›</span>}
                </div>
              )}
            </NavLink>

            <NavLink to="/hr/attendance" className="w-full text-left">
              {({ isActive }) => (
                <div className={`w-full flex items-center justify-between px-5 py-3 ${isActive ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600" : isDark ? "text-gray-300 hover:bg-slate-800" : "text-gray-700 hover:bg-gray-100"}`}>
                  <div className="flex items-center gap-2">
                    <FaPlaneDeparture className="w-4 h-4" />
                    {!isCollapsed && <span>Attendance & Leaves</span>}
                  </div>
                  {!isCollapsed && <span>›</span>}
                </div>
              )}
            </NavLink>
          </div>
        </>
      )}

      {/* ---------- EMPLOYEE ---------- */}
      {role === "employee" && (
        <>
          <Title>PERSONAL</Title>

          <NavLink to="/employee" className="w-full text-left">
            {({ isActive }) => <Item icon={FaHome} label="Dashboard" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/my-profile" className="w-full text-left">
            {({ isActive }) => <Item icon={FaUsers} label="My Profile" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/my-tasks" className="w-full text-left">
            {({ isActive }) => <Item icon={FaUsers} label="Tasks Assigned" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/holiday-list" className="w-full text-left">
            {({ isActive }) => <Item icon={FaPlaneDeparture} label="Holiday List" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/important-notice" className="w-full text-left">
            {({ isActive }) => <Item icon={FaBullhorn} label="Important Notices" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/leave-application" className="w-full text-left">
            {({ isActive }) => <Item icon={FaPlaneDeparture} label="Leave Application" active={isActive} />}
          </NavLink>

          <NavLink to="/employee/messenger" className="w-full text-left">
            {({ isActive }) => (
              <Item
                icon={FaBullhorn}
                label="Messenger"
                active={isActive}
                badge={messageUnread}
              />
            )}
          </NavLink>

          <NavLink to="/employee/performance" className="w-full text-left">
            {({ isActive }) => <Item icon={FaChartBar} label="My Performance" active={isActive} />}
          </NavLink>
        </>
      )}

      {/* LOGOUT */}
      <div className="mt-auto">
        <button onClick={handleLogout} className="w-full text-left">
          <Item icon={FaSignOutAlt} label="Logout" active={false} />
        </button>

        {/* collapse toggle */}
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={toggleCollapse}
            className="w-full flex justify-end text-gray-400 hover:text-gray-600 transition"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <FaChevronRight className="w-4 h-4" /> : <FaChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
