import React, { useState, useEffect } from "react";
import HrWelcomePage from "./HRWelcomepage";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const HrDashboard = () => {
  const [lastLoginTime, setLastLoginTime] = useState("");
  const [employeeCount, setEmployeeCount] = useState(0);
  const [pmCount, setPmCount] = useState(0);
  const [hrDetails, setHrDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCredentialsCount, setPendingCredentialsCount] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  const navigate = useNavigate();

  // Format last login
  useEffect(() => {
    const now = new Date();
    const formattedDate = now.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    setLastLoginTime(formattedDate);
  }, []);

  // Get HR details from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("users");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setHrDetails(parsed);
      }
    } catch (error) {
      console.error("Error parsing HR details from localStorage:", error);
    }
  }, []);

  // Fetch employees and filter only those assigned to this HR
  useEffect(() => {
    const fetchEmployeesForHr = async () => {
      if (!hrDetails) return;

      try {
        setLoading(true);

        // Fetch all employees
        const res = await axios.get("http://localhost:5000/api/employees");
        const allEmployees = res.data || [];

        const thisHrId = hrDetails._id || null;
        const thisHrEmail = hrDetails.email?.toLowerCase() || null;

        const employeesUnderThisHr = allEmployees.filter((emp) => {
          if (!emp.assignedHr) return false;

          // assignedHr might be populated object or just an id
          if (typeof emp.assignedHr === "object") {
            // populated: { _id, name, email }
            if (thisHrId && emp.assignedHr._id === thisHrId) return true;
            if (
              thisHrEmail &&
              emp.assignedHr.email &&
              emp.assignedHr.email.toLowerCase() === thisHrEmail
            ) {
              return true;
            }
            return false;
          } else {
            // not populated: just an ObjectId string
            if (thisHrId && emp.assignedHr === thisHrId) return true;
            return false;
          }
        });

        // Count employees and PMs under this HR
        const employeeUsers = employeesUnderThisHr.filter(
          (emp) => emp.role && emp.role.toLowerCase() === "employee"
        );
        setEmployeeCount(employeeUsers.length);

        const employeePm = employeesUnderThisHr.filter(
          (emp) => emp.role && emp.role.toLowerCase() === "project managers"
        );
        setPmCount(employeePm.length);

        // ✅ Pending credentials count: anyone under this HR whose credentialstatus is not "Completed"
        const pendingCreds = employeesUnderThisHr.filter(
          (emp) =>
            !emp.credentialstatus ||
            emp.credentialstatus.toLowerCase() !== "completed"
        ).length;

        setPendingCredentialsCount(pendingCreds);

        // Fetch pending leaves for this HR for dashboard card
        try {
          const leavesRes = await axios.get(
            "http://localhost:5000/api/leaves/hr/pending"
          );
          setPendingLeavesCount(leavesRes.data?.length || 0);
        } catch (leavesErr) {
          console.error("Error fetching pending leaves:", leavesErr);
        }
      } catch (err) {
        console.error("Error fetching employees:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeesForHr();
  }, [hrDetails]);

  // Example values for other cards (replace with real API calls when available)
  const recruitmentOpen = 5;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center px-4 py-6">
      <div className="w-full max-w-7xl space-y-6">
        {/* Keep HrWelcomePage unchanged */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <HrWelcomePage />
          </div>

          {/* Create Report button */}
          <div className="ml-4">
            <button
              type="button"
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded shadow hover:bg-blue-700"
            >
              Create Report
            </button>
          </div>
        </div>

        {/* Main HR card area */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: HR Details large card */}
            <div className="w-full lg:w-1/3 bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                  <img
                    src={
                      hrDetails?.profilePic || "https://via.placeholder.com/150"
                    }
                    alt="HR Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    HR Details
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Name:{" "}
                    <span className="font-medium text-gray-800">
                      {hrDetails?.name || "—"}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Email:{" "}
                    <span className="text-gray-800">
                      {hrDetails?.email || "—"}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Role:{" "}
                    <span className="text-gray-800">
                      {hrDetails?.role || "HR"}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Department:{" "}
                    <span className="text-gray-800">
                      {hrDetails?.department || "Human Resources"}
                    </span>
                  </p>
                  <p className="text-gray-400 text-sm mt-3">
                    Last login: {lastLoginTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Grid of cards */}
            <div className="w-full lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Employees Under Supervision */}
              <div className="bg-white rounded-lg p-5 shadow border flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm text-gray-500">
                      Employees Under Supervision
                    </h3>
                    <p className="text-3xl font-extrabold text-blue-900 mt-4">
                      {loading ? "…" : employeeCount}
                    </p>
                    <p className="text-xs text-green-500 mt-1">
                      +2 from last week
                    </p>
                  </div>
                  <div className="bg-blue-100 rounded p-3">
                    <svg
                      className="w-6 h-6 text-blue-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0zM6 14a4 4 0 00-4 4v1h12v-1a4 4 0 00-4-4H6z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                  onClick={()=> navigate("/hr/employee-records")}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
                    View All
                  </button>
                </div>
              </div>

              {/* Pending Credentials */}
              <div className="bg-white rounded-lg p-5 shadow border flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 classNamee="text-sm text-gray-500">
                      Pending Credentials
                    </h3>
                    <p className="text-3xl font-extrabold text-blue-900 mt-4">
                      {loading ? "…" : pendingCredentialsCount}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Awaiting setup</p>
                  </div>
                  <div className="bg-yellow-100 rounded p-3">
                    <svg
                      className="w-6 h-6 text-yellow-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 2a6 6 0 100 12A6 6 0 0010 2zM2 18a8 8 0 0116 0H2z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => navigate("/hr/add-credentials")}
                    className="text-sm bg-white border border-blue-600 text-blue-600 px-3 py-1 rounded"
                  >
                    Create Now
                  </button>
                </div>
              </div>

                {/* Leave Requests */}
              <div className="bg-white rounded-lg p-5 shadow border flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm text-gray-500">Leave Requests</h3>
                    <p className="text-3xl font-extrabold text-blue-900 mt-4">
                      {loading ? "…" : pendingLeavesCount}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Pending approval
                    </p>
                  </div>
                  <div className="bg-green-100 rounded p-3">
                    <svg
                      className="w-6 h-6 text-green-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H8V2H6z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded">
                    Review
                  </button>
                </div>
              </div>

              {/* Recruitment */}
              <div className="bg-white rounded-lg p-5 shadow border flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm text-gray-500">Recruitment</h3>
                    <p className="text-3xl font-extrabold text-blue-900 mt-4">
                      {recruitmentOpen}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Open positions
                    </p>
                  </div>
                  <div className="bg-red-100 rounded p-3">
                    <svg
                      className="w-6 h-6 text-red-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6 7V6a2 2 0 012-2h4a2 2 0 012 2v1h3v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7h3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="text-sm bg-white border border-blue-600 text-blue-600 px-3 py-1 rounded">
                    View
                  </button>
                </div>
              </div>

              {/* Placeholder to keep 3-column layout on wide screens */}
              <div className="hidden lg:flex items-center justify-center bg-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrDashboard;
