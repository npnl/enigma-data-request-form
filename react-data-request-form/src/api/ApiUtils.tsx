import {
  DataRequestsResponse,
  DataRequestIn,
  DataRequestOut,
} from "../types/DataRequest";
import {
  AuthorsOptions,
  DataFrame,
  DataSummaries,
  Dictionary,
  FetchDataResponse,
  FormattedAuthorsRequest,
  FormattedAuthorsResponse,
  pdfData,
  QCDataResponse,
} from "../types/DataTypes";
import HttpClient from "./HttpClient";

const fetchRequests = async () => {
  const requests = await HttpClient.get<DataRequestIn[]>("get-requests");
  // console.log(requests)
  return requests;
};

const submitRequest = async (data: DataRequestOut) => {
  const response = await HttpClient.post<Response>("submit-request", data);
  return response;
};

const fetchRequest = async (fileName: string) => {
  const dataRequest = await HttpClient.get<DataRequestIn>(
    `get-request/${fileName}`
  );
  return dataRequest;
};

const getData = async (data: DataRequestOut) => {
  const response = await HttpClient.post<FetchDataResponse>("view", data);
  return response;
};

const fetchDataAndSummary = async (data: DataRequestOut) => {
  const response = await HttpClient.post<DataSummaries>("data-summary", data);
  return response;
};

const fetchDataAndSummaryByFilename = async (fileName: string) => {
  const response = await HttpClient.get<DataSummaries>(
    `data-summary/${fileName}`
  );
  return response;
};

const fetchBooleanData = async () => {
  const response = await HttpClient.get<DataFrame>("boolean-data");
  return response;
};

const fetchAuthorsData = async () => {
  const response = await HttpClient.get<AuthorsOptions>("get-authors-list");
  return response;
};

const fetchFormattedAuthors = async (
  formattedAuthorsRequest: FormattedAuthorsRequest
) => {
  const response = await HttpClient.post<FormattedAuthorsResponse>(
    "formatted-authors",
    formattedAuthorsRequest
  );
  return response;
};

const fetchQCSubjectsData = async () => {
  const response = await HttpClient.get<DataFrame>("qc-data");
  return response;
};

const fetchPDFData = async (bidsId: string, sesId: string) => {
  const response = await HttpClient.get<QCDataResponse>(
    `qc-pdf-data/${bidsId}/${sesId}`
  );
  return response;
};

const updateQCData = async (
  bidsId: string,
  sesId: string,
  data: Dictionary<string | number>
) => {
  const response = await HttpClient.post<Response>(
    `qc-pdf-data/${bidsId}/${sesId}`,
    data
  );
  return response;
};

export default {
  fetchRequests,
  // getData,
  submitRequest,
  fetchRequest,
  fetchDataAndSummary,
  fetchDataAndSummaryByFilename,
  fetchBooleanData,
  fetchAuthorsData,
  fetchFormattedAuthors,
  fetchQCSubjectsData,
  fetchPDFData,
  updateQCData,
};
