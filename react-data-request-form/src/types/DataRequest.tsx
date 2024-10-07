import { Timepoint, MetricsData } from "./MetricsData";

export interface DataRequestIn {
    file_name: string;
    time: Date;
    name: string;
    email: string;
    data: DataRequestOut;
    status: string;
}

export interface DataRequestOut {
    requestor: User | undefined;
    timepoint: Timepoint;
    behavior: { [key: string]: MetricOut };
    imaging: { [key: string]: MetricOut };
    notes: string;
}

export interface MetricOut {
    required: boolean;
    value1: string | number;
    value2: string | number;
    type: string;
    category: string;
}


export interface DataRequestsResponse {
    requests: DataRequestIn[];
}

export interface User {
    name: string;
    email: string;
}

export interface Response {
    status: string;
    message: string;
    error: string;
}

