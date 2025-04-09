import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { z } from "zod";

export interface CsvRow {
  firstname: string;
  lastname: string;
  username: string;
  uid: number;
  password: string;
  email: string;
  membershipplanid: number;
}

export interface ExtendedCsvRow extends CsvRow {
  activationStatus: string;
}

const csvSchema = z.object({
  firstname: z.string().nonempty("First name is required"),
  lastname: z.string().nonempty("Last name is required"),
  username: z.string().nonempty("Username is required"),
  uid: z.coerce.number().refine((val) => !Number.isNaN(val), { message: "UID must be a number" }),
  password: z.string().nonempty("Password is required"),
  email: z.string().email("Invalid email format"),
  membershipplanid: z.coerce
    .number()
    .refine((val) => !Number.isNaN(val), { message: "Membership Plan id must be a number" }),
});

const CsvFileUploader: React.FC = () => {
  const [validatedData, setValidatedData] = useState<ExtendedCsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to clear current data and reset the file input.
  const handleClear = () => {
    setValidatedData([]);
    setErrors([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Function to call the API for a single CSV row.
  const fetchActivationStatusForRow = async (row: CsvRow): Promise<ExtendedCsvRow> => {
    try {
      const apiUrl = `/api/?ihc_action=api-gate&ihch=F4ARzxSFjQpZxqjt5jiJn7HlXqMu23Y&action=user_add_level&uid=${row.uid}&lid=${row.membershipplanid}`;
      const response = await fetch(apiUrl);
      const result = await response.json();
      const activationStatus = result.response === true ? "Activated" : "Inactive";
      return { ...row, activationStatus };
    } catch (error) {
      console.error("Error fetching activation status:", error);
      return { ...row, activationStatus: "Error" };
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvString = e.target?.result as string;
        Papa.parse(csvString, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const expectedHeaders = [
              "firstname",
              "lastname",
              "username",
              "uid",
              "password",
              "email",
              "membershipplanid",
            ];
            if (!results.meta.fields || results.meta.fields.join(",") !== expectedHeaders.join(",")) {
              setErrors([`CSV header does not match expected order. Expected: ${expectedHeaders.join(", ")}`]);
              setValidatedData([]);
              return;
            }

            const data = results.data as any[];
            const validRows: CsvRow[] = [];
            const errorList: string[] = [];

            data.forEach((row, index) => {
              const parseResult = csvSchema.safeParse(row);
              if (parseResult.success) {
                validRows.push(parseResult.data);
              } else {
                const rowErrors = parseResult.error.errors.map(
                  (err) => `Row ${index + 1} - ${err.path.join(" ")}: ${err.message}`
                );
                errorList.push(...rowErrors);
              }
            });

            setErrors(errorList);

            setLoading(true);
            try {
              const extendedRows = await Promise.all(validRows.map((row) => fetchActivationStatusForRow(row)));
              setValidatedData(extendedRows);
            } catch (err) {
              console.error("Error fetching activation statuses", err);
            } finally {
              setLoading(false);
            }
          },
          error: (error: any) => {
            console.error("Error parsing CSV:", error);
          },
        });
      };
      reader.readAsText(file);
    }
  };
  const handleDownloadHeaderCSV = () => {
    const headers = [["firstname", "lastname", "username", "uid", "password", "email", "membershipplanid"]];
    const csv = Papa.unparse(headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "csv_header_format.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSV = () => {
    if (validatedData.length === 0) return;
    const csv = Papa.unparse(validatedData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "activation_results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container">
      <div className="card">
        <h2 className="title">Upload CSV File</h2>
        <div className="upload-section">
          <label className="label">Choose a CSV file:</label>
          <div className="download-header-section">
            <button className="download-header" onClick={handleDownloadHeaderCSV}>
              Download CSV Header
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="input-file" />
        </div>
        <div className="download-row">
          {(validatedData.length > 0 || errors.length > 0) && (
            <div className="clear-button-section">
              <button className="clear" onClick={handleClear}>
                Clear Upload
              </button>
            </div>
          )}
          {validatedData.length > 0 && !loading && (
            <div className="download-button-section">
              <button className="download" onClick={handleDownloadCSV}>
                Download Activation Result
              </button>
            </div>
          )}
        </div>
        {errors.length > 0 && (
          <div className="error-section">
            <h3>Validation Errors:</h3>
            <ul>
              {errors.map((err, idx) => (
                <li key={idx}>
                  {" "}
                  <p className="error"> {err}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {loading && (
          <div className="loading">
            <img className="loading-img" src="../../src/assets/loading.gif" alt="Loading..." width="24" />
          </div>
        )}
        {validatedData.length > 0 && !loading && (
          <div className="table-container">
            <h3 className="table-title">MemberShip Activation Result</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Username</th>
                    <th>UID</th>
                    <th>Password</th>
                    <th>Email</th>
                    <th>Plan Id</th>
                    <th>Activation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedData.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.firstname}</td>
                      <td>{row.lastname}</td>
                      <td>{row.username}</td>
                      <td>{row.uid}</td>
                      <td>{row.password}</td>
                      <td>{row.email}</td>
                      <td>{row.membershipplanid}</td>
                      <td
                        style={{
                          fontWeight: "bold",
                          color:
                            row.activationStatus === "Activated"
                              ? "green"
                              : row.activationStatus === "Inactive"
                              ? "red"
                              : "inherit",
                        }}
                      >
                        {row.activationStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvFileUploader;
