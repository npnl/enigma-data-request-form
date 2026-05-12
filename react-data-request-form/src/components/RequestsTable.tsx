import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { DataRequestIn } from "../types/DataRequest";
import ApiUtils from "../api/ApiUtils";
import { getCurrentUserToken } from "../services/authService";


const RequestsTable = () => {
  const [files, setFiles] = useState<DataRequestIn[]>([]);
  const navigate = useNavigate();
  const userAuth = JSON.parse(localStorage.getItem("userAuth") || "{}");
  const isAdminFromStorage = userAuth.is_admin || false;
  useEffect(() => {
    if (!isAdminFromStorage) {
      navigate("/request-form");
      return;
    }
    const loadData = async () => {
      try {
        const token = await getCurrentUserToken();
        const requests = await ApiUtils.fetchRequests(token);
        if (requests) {
          setFiles(requests);
        } else {
          console.log("No data returned from fetchRequests");
          setFiles([]); 
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
        setFiles([]);
      }
    };
    loadData();
  }, [isAdminFromStorage, navigate]);

  const viewFile = (fileName: string) => {
    sessionStorage.setItem("currentFileName", fileName);
    navigate(`/request-summary/${fileName}`);
  };
  if (!isAdminFromStorage) {
    return null;
  }

  return (
    <TableContainer component={Paper} className="mt-4">
      <h2>Data Requests</h2>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Time</TableCell>
            <TableCell>File Name</TableCell>
            <TableCell>Secondary Proposal Status</TableCell>
            <TableCell>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {files &&
            files.map((file) => (
              <TableRow key={file.file_name ?? ""}>
                <TableCell>{file.name ?? ""}</TableCell>
                <TableCell>{file.email ?? ""}</TableCell>
                <TableCell>{file?.time?.toString() ?? ""}</TableCell>
                <TableCell>{file.file_name ?? ""}</TableCell>
                <TableCell>{file.data.proposal_status || "No status provided"}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => viewFile(file.file_name)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RequestsTable;
