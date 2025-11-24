import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiCheck, FiX, FiSearch, FiCalendar } from "react-icons/fi";

export default function AttendanceLeavePanel() {
  const [attendance, setAttendance] = useState([]);
  const [month, setMonth] = useState("");
  const [employeesMap, setEmployeesMap] = useState({}); // ID → name map
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("users"));
  const isEmployee = storedUser?.role === "employee";
  const employeeId = storedUser?.employeeId;

  // ---------------------------------------------------------------------
  // Fetch ALL Employees once → store in a map { _id: name }
  // ---------------------------------------------------------------------
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/employees");
        const map = {};

        res.data.forEach((emp) => {
          map[emp._id] = emp.name;
        });

        setEmployeesMap(map);
      } catch (err) {
        console.error("Employees Fetch Error:", err);
      }
    };

    fetchEmployees();
  }, []);

  // ---------------------------------------------------------------------
  // Fetch attendance
  //  - employee → /employee/:id
  //  - hr/director → /all
  // ---------------------------------------------------------------------
  const fetchAttendance = async () => {
    try {
      let url = "";

      if (isEmployee) {
        if (!employeeId) return;
        url = `http://localhost:5000/api/attendance/employee/${employeeId}?month=${month}`;
      } else {
        url = `http://localhost:5000/api/attendance/all?month=${month}`;
      }

      const res = await axios.get(url);
      setAttendance(res.data);
    } catch (err) {
      console.error("Attendance Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // ---------------------------------------------------------------------
  // Fetch pending leave requests for this HR
  // ---------------------------------------------------------------------
  const fetchLeaveRequests = async () => {
    try {
      setLeaveLoading(true);
      const res = await axios.get(
        "http://localhost:5000/api/leaves/hr/pending"
      );
      setLeaveRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Leave Requests Fetch Error:", err);
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (!isEmployee) {
      fetchLeaveRequests();
    }
  }, [isEmployee]);

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  const formatTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateHours = (inTime, outTime) => {
    if (!inTime || !outTime) return "-";
    const diff = (new Date(outTime) - new Date(inTime)) / 1000;
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // 👉 Smart resolver: handles populated object OR raw ID
  const getEmployeeName = (row) => {
    if (!row.employee) return "Unknown";

    // If populated: { _id, name, ... }
    if (typeof row.employee === "object") {
      return row.employee.name || "Unknown";
    }

    // If still ID string: use map
    return employeesMap[row.employee] || "Unknown";
  };

  const handleLeaveAction = async (id, action) => {
    try {
      await axios.patch(
        `http://localhost:5000/api/leaves/${id}/status`,
        { status: action }
      );
      setLeaveRequests((prev) => prev.filter((req) => req._id !== id));
    } catch (err) {
      console.error("Update leave status error:", err);
    }
  };

  // ---------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------
  return (
    <div className="space-y-6 text-gray-800 dark:text-gray-100">
      {/* Header */}
      <div className="text-3xl font-semibold">Attendance & Leave Management</div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded-md flex-1">
          <FiSearch className="text-gray-500" />
          <input
            placeholder="Search employee"
            className="ml-2 bg-transparent outline-none w-full"
          />
        </div>

        <div className="flex items-center bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded-md">
          <FiCalendar className="text-gray-500" />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent ml-2 outline-none"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {["Present: 21", "Absent: 2", "Leave Requests: 5"].map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 shadow p-5 rounded-lg text-center font-semibold text-lg"
          >
            {stat}
          </div>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-bold mb-3 text-xl">Attendance Record</h3>

        <table className="w-full text-sm">
          <thead className="border-b border-gray-300 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="py-2">Employee</th>
              <th>Date</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Hours Worked</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {attendance.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                {/* Employee Name (handles both populate + id) */}
                <td className="py-2 font-medium">
                  {getEmployeeName(row)}
                </td>

                {/* Date */}
                <td>{new Date(row.date).toLocaleDateString()}</td>

                {/* Times */}
                <td>{formatTime(row.loginAt)}</td>
                <td>{formatTime(row.logoutAt)}</td>

                {/* Hours */}
                <td>{calculateHours(row.loginAt, row.logoutAt)}</td>

                {/* Status */}
                <td
                  className={`font-medium ${
                    row.status === "Present"
                      ? "text-green-500"
                      : row.status === "Absent"
                      ? "text-red-500"
                      : "text-yellow-500"
                  }`}
                >
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leave Requests */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-bold mb-3 text-xl">Pending Leave Requests</h3>

        {leaveLoading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Loading leave requests...
          </div>
        )}

        {!leaveLoading && leaveRequests.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No pending leave requests.
          </div>
        )}

        {leaveRequests.map((req) => (
          <div
            key={req._id}
            className="flex justify-between items-center p-4 rounded-lg border dark:border-gray-600 mb-3"
          >
            <div>
              <h4 className="font-semibold">
                {req.employee?.name || "Unknown Employee"}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {req.leaveType} •
                {" "}
                {req.startDate
                  ? new Date(req.startDate).toLocaleDateString()
                  : ""}
                {" "}
                -
                {" "}
                {req.endDate
                  ? new Date(req.endDate).toLocaleDateString()
                  : ""}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Reason: {req.reason}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleLeaveAction(req._id, "Approved")}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <FiCheck /> Approve
              </button>
              <button
                onClick={() => handleLeaveAction(req._id, "Rejected")}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <FiX /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}