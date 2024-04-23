import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataRequestIn } from '../types/DataRequest'; 
import ApiUtils from '../api/ApiUtils'; 

const RequestsTable = () => {
    const [files, setFiles] = useState<DataRequestIn[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            try {
                const requests = await ApiUtils.fetchRequests();
                if (requests) {
                    setFiles(requests);
                } else {
                    console.log('No data returned from fetchRequests');
                    setFiles([]); // Set to empty array to ensure consistent data type
                }
            } catch (error) {
                console.error('Failed to fetch requests:', error);
                setFiles([]); // Set to empty array on error
            }
        };
        loadData();
    }, []);
    

    const viewFile = (fileName: string) => {
        sessionStorage.setItem('currentFileName', fileName);
        navigate(`/request-summary/${fileName}`);
    };

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
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { files && files.map((file) => (
                        <TableRow key={file.file_name ?? ''}>
                            <TableCell>{file.name ?? ''}</TableCell>
                            <TableCell>{file.email ?? ''}</TableCell>
                            <TableCell>{file?.time?.toString() ?? ''}</TableCell>
                            <TableCell>{file.file_name ?? ''}</TableCell>
                            <TableCell>{file.status ?? ''}</TableCell>
                            <TableCell>
                                <Button variant="contained" color="primary" onClick={() => viewFile(file.file_name)}>
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
