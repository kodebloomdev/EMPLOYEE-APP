import React, { useState, useContext } from "react"; // Import useContext
import axios from "axios";
import { ThemeContext } from "../../context/ThemeContext"; 
// Import ThemeContext

const BASE_URL =
  typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL
    : "http://localhost:5173";

const LeaveApplication = () => {
  const { theme } = useContext(ThemeContext); // Get theme from context

  const storedUser = JSON.parse(localStorage.getItem("users") || "null");
  const employeeId = storedUser?.employeeId || "";
  const employeeName = storedUser?.name || "";

  const [form, setForm] = useState({
    leaveType: "Annual",
    startDate: "",
    endDate: "",
    reason: "",
    contactDuringLeave: "",
  });
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
    setError("");
    setSuccess("");
  };

  const onFileChange = (e) => {
    setAttachment(e.target.files?.[0] || null);
    setError("");
    setSuccess("");
  };

  const validate = () => {
    if (!form.startDate || !form.endDate) {
      return "Please select both start and end dates.";
    }
    const s = new Date(form.startDate);
    const e = new Date(form.endDate);
    if (isNaN(s) || isNaN(e)) return "Invalid date(s) provided.";
    if (s > e) return "Start date cannot be after end date.";
    if (!form.reason || form.reason.trim().length < 5) return "Please provide a brief reason (min 5 characters).";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationMsg = validate();
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        contactDuringLeave: form.contactDuringLeave,
      };

      const res = await axios.post("http://localhost:5000/api/leaves", payload, {
        headers: { "Content-Type": "application/json" },
      });

      setSuccess(
        res.data?.message || "Leave application submitted successfully."
      );

      setForm({
        leaveType: "Annual",
        startDate: "",
        endDate: "",
        reason: "",
        contactDuringLeave: "",
      });
      setAttachment(null);
      // Clear the file input visually
      if (e.target.elements) {
          const fileInput = Array.from(e.target.elements).find(el => el.type === 'file');
          if (fileInput) fileInput.value = '';
      }

    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "Failed to submit leave application. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Define base and theme-specific styles
  const baseInputStyle = "w-full px-3 py-2 border rounded focus:outline-none focus:ring-2";
  const lightInputStyle = "bg-white border-gray-300 text-gray-800 focus:ring-blue-500";
  const darkInputStyle = "bg-slate-700 border-slate-600 text-gray-100 focus:ring-teal-500";
  const inputStyle = `${baseInputStyle} ${theme === 'dark' ? darkInputStyle : lightInputStyle}`;

  const baseLabelStyle = "block mb-1 text-sm font-medium";
  const lightLabelStyle = "text-gray-700";
  const darkLabelStyle = "text-gray-300";
  const labelStyle = `${baseLabelStyle} ${theme === 'dark' ? darkLabelStyle : lightLabelStyle}`;

  const baseFileStyle = "w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold";
  const lightFileStyle = "text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100";
  const darkFileStyle = "text-gray-400 file:bg-slate-700 file:text-teal-300 hover:file:bg-slate-600";
  const fileInputStyle = `${baseFileStyle} ${theme === 'dark' ? darkFileStyle : lightFileStyle}`;

  return (
    <div className={`p-8 rounded-xl shadow max-w-3xl mx-auto ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
      <h2 className={`text-2xl font-semibold mb-6 border-b pb-3 ${theme === 'dark' ? 'text-gray-100 border-slate-700' : 'text-gray-800 border-gray-200'}`}>📝 Apply for Leave</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelStyle}>Employee</label>
            <input
              type="text"
              value={employeeName || employeeId || "N/A"}
              readOnly
              className={`w-full px-3 py-2 border rounded cursor-not-allowed ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>

          <div>
            <label htmlFor="leaveType" className={labelStyle}>Leave Type</label>
            <select
              id="leaveType"
              name="leaveType"
              value={form.leaveType}
              onChange={onChange}
              className={inputStyle} // Use combined style
            >
              <option>Annual</option>
              <option>Sick</option>
              <option>Casual</option>
              <option>Unpaid</option>
              <option>Maternity/Paternity</option>
            </select>
          </div>

          <div>
            <label htmlFor="startDate" className={labelStyle}>Start Date</label>
            <input
              id="startDate" type="date" name="startDate" value={form.startDate} onChange={onChange} required
              className={`${inputStyle} ${theme === 'dark' ? '[color-scheme:dark]' : ''}`} // Add color-scheme for dark date picker icon
            />
          </div>

          <div>
            <label htmlFor="endDate" className={labelStyle}>End Date</label>
            <input
              id="endDate" type="date" name="endDate" value={form.endDate} onChange={onChange} required
              className={`${inputStyle} ${theme === 'dark' ? '[color-scheme:dark]' : ''}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reason" className={labelStyle}>Reason</label>
          <textarea
            id="reason" name="reason" value={form.reason} onChange={onChange} rows={3} required
            className={inputStyle} // Use combined style
            placeholder="Brief reason for leave (min 5 characters)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="contactDuringLeave" className={labelStyle}>Contact During Leave</label>
            <input
              id="contactDuringLeave" type="text" name="contactDuringLeave" value={form.contactDuringLeave} onChange={onChange}
              className={inputStyle} // Use combined style
              placeholder="Phone or email (optional)"
            />
          </div>

          <div>
            <label htmlFor="attachment" className={labelStyle}>Attachment (optional)</label>
            <input
              id="attachment" type="file" onChange={onFileChange}
              className={fileInputStyle} // Use combined file style
            />
          </div>
        </div>

        {error && <div className={`p-3 rounded text-sm ${theme === 'dark' ? 'bg-red-900 bg-opacity-30 text-red-300' : 'bg-red-100 text-red-700'}`}>{error}</div>}
        {success && <div className={`p-3 rounded text-sm ${theme === 'dark' ? 'bg-green-900 bg-opacity-30 text-green-300' : 'bg-green-100 text-green-700'}`}>{success}</div>}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`px-5 py-2 rounded font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme === 'dark' ? 'bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500 focus:ring-offset-slate-800' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 focus:ring-offset-white'}`}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>

          <button
            type="button"
            onClick={() => {
              setForm({ leaveType: "Annual", startDate: "", endDate: "", reason: "", contactDuringLeave: "" });
              setAttachment(null);
              const formElement = document.querySelector('form');
              if (formElement) {
                const fileInput = formElement.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = '';
              }
              setError("");
              setSuccess("");
            }}
            className={`px-5 py-2 border rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme === 'dark' ? 'border-slate-600 text-gray-300 hover:bg-slate-700 focus:ring-slate-500 focus:ring-offset-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-gray-400 focus:ring-offset-white'}`}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveApplication;