import { DataRequestsResponse, DataRequestIn, DataRequestOut } from "../types/DataRequest";
import { DataFrame, DataSummaries, FetchDataResponse } from "../types/DataTypes";
import HttpClient from "./HttpClient";


const fetchRequests = async () => {
    const requests = await HttpClient.get<DataRequestIn[]>('get-requests');
    // console.log(requests)
    return requests;
}

const submitRequest = async (data: DataRequestOut) => {
    const response = await HttpClient.post<Response>('submit-request', data);
    return response;
}

const fetchRequest = async (fileName: string) => {
    const dataRequest = await HttpClient.get<DataRequestIn>(`get-request/${fileName}`);
    return dataRequest;
}

const getData = async (data: DataRequestOut) => {
    const response = await HttpClient.post<FetchDataResponse>('view', data);
    return response;
}

const fetchDataAndSummary = async (data: DataRequestOut) => {
    const response = await HttpClient.post<DataSummaries>('data-summary', data);
    return response
}

const fetchDataAndSummaryByFilename = async (fileName: string) => {
    const response = await HttpClient.get<DataSummaries>(`data-summary/${fileName}`);
    return response
}

const fetchBooleanData = async () => {
    const response = await HttpClient.get<DataFrame>('boolean-data');
    return response
}



export default {
    fetchRequests,
    // getData,
    submitRequest,
    fetchRequest,
    fetchDataAndSummary,
    fetchDataAndSummaryByFilename,
    fetchBooleanData
};