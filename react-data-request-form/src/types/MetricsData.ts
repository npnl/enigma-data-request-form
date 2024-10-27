// Define the basic structure for each metric
export type MetricType = "float" | "int" | "string" | "image";

export interface Metric {
  metric_name: string;
  variable_type: MetricType;
  description: string;
  is_required: boolean;
  is_selected: boolean;
  filter_value1: string | number | undefined;
  filter_value2: string | number | undefined;
}

export interface MetricsData {
  [category: string]: Metric[];
}

export interface GetMetricResponse {
  behavioral: MetricsData;
  imaging: string[];
}

export type Timepoint = "baseline" | "multi";
