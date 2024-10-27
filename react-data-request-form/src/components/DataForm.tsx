import BehavioralMetricContainer from "./Behavioral/BehavioralSection";
import ImagingMetricContainer from "./Imaging/ImagingSection";
import RecordCount from "./RecordsCount";
import TimepointSelection from "./TimepointSelection";
import env from "../config";
import UserDataInputs from "./UserDataInputs";
import { Button, Form } from "react-bootstrap";
import { useAppDispatch } from "../hooks";
import { showModal } from "../redux/modalSlice";
import { DataRequestOut, MetricOut } from "../types/DataRequest";
import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import ApiUtils from "../api/ApiUtils";
import { RootState } from "../redux/store";
import { Metric } from "../types/MetricsData";
import { useNavigate } from "react-router-dom";
import { setDataSummary } from "../redux/requestsSlice";

const DataForm = () => {
  const metricsData = useSelector((state: RootState) => state.metrics);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    dispatch(
      showModal({
        title: "Processing",
        message: "Please wait...",
        modalType: "loading",
      })
    );
    // Insert your submit logic here

    let data: DataRequestOut = {
      timepoint: metricsData.timepoint,
      behavior: {},
      imaging: {},
      notes: "",
      requestor: undefined,
    };

    Object.keys(metricsData.behavioralMetrics).flatMap((category) =>
      Object.values(metricsData.behavioralMetrics[category])
        .filter((metric) => metric.is_selected)
        .map((metric: Metric) => {
          let metricData: MetricOut = {
            required: metric.is_required,
            value1: metric.filter_value1 || "",
            value2: metric.filter_value2 || "",
            type: metric.variable_type,
            category: category,
          };
          if (metric.metric_name) {
            const metricName = metric.metric_name;
            data.behavior[metricName] = metricData;
          }
        })
    );

    // Collecting imaging metrics
    Object.values(metricsData.imagingMetrics["imaging"])
      .filter((metric: Metric) => metric.is_selected)
      .map((metric: Metric) => {
        let metricData: MetricOut = {
          required: metric.is_required,
          value1: metric.filter_value1 || "",
          value2: metric.filter_value2 || "",
          type: metric.variable_type,
          category: "imaging", // Assuming all are categorized as 'imaging'
        };
        if (metric.metric_name) {
          const metricName = metric.metric_name;
          data.imaging[metricName] = metricData;
        }
      });

    if (
      Object.keys(data.imaging).length == 0 &&
      Object.keys(data.behavior).length == 0
    ) {
      dispatch(
        showModal({
          title: "Warning",
          message: "You haven't selected any data!",
          modalType: null,
        })
      );
    } else {
      try {
        const response = await ApiUtils.fetchDataAndSummary(data);
        dispatch(setDataSummary(response));
        navigate("view-data");
        dispatch(
          showModal({
            title: "Success",
            message: "Your request has been successfully submitted!",
            modalType: "success",
          })
        );
      } catch (error) {
        dispatch(
          showModal({
            title: "Error",
            message: "Failed to submit the request. Please try again.",
            modalType: "error",
          })
        );
      }
    }
  };
  return (
    <>
      {env.USER_MODE && env.USER_MODE === "admin" && (
        <Button variant="outline-primary" className="mt-3 mb-2">
          Upload State
        </Button>
      )}
      <TimepointSelection />
      <BehavioralMetricContainer />
      <ImagingMetricContainer />
      <RecordCount />
      {env.USER_MODE && env.USER_MODE === "user" && (
        <>
          <UserDataInputs />
        </>
      )}
      {env.USER_MODE && env.USER_MODE === "admin" && (
        <div className="d-flex justify-content-between mb-5 mt-3">
          <div className="d-flex justify-content-start">
            <Button variant="primary" className="mr-2" onClick={handleSubmit}>
              View Data
            </Button>
            <Button variant="primary">Download Data</Button>
          </div>
          <Button variant="outline-primary">Download State</Button>
        </div>
      )}
    </>
  );
};

export default DataForm;
