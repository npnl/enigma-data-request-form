import BehavioralMetricContainer from "./DataRequestForm/Behavioral/BehavioralSection";
import ImagingMetricContainer from "./DataRequestForm/Imaging/ImagingSection";
import RecordCount from "./RecordsCount";
import TimepointSelection from "./TimepointSelection";
import UserDataInputs from "./UserDataInputs";
import { Button, Dropdown } from "react-bootstrap";
import { useAppDispatch } from "../hooks";
import { showModal } from "../redux/modalSlice";
import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import ApiUtils from "../api/ApiUtils";
import { RootState } from "../redux/store";
import { useNavigate } from "react-router-dom";
import SearchBar from './DataRequestForm/SearchBar';
import {scroller} from 'react-scroll';
import MetricsLogicSummary from './DataRequestForm/MetricsLogicSummary';
import { restoreStateFromJSON, updateRowCount, resetFormState } from '../redux/metricsSlice';
import { parseJSONToState, createDownloadableState } from '../stateRestoration';
import {getCurrentUserToken} from '../services/authService';

interface MetricSummary {
  category: string;
  subcategory?: string;
  metricName: string;
  displayName: string;
  type: string;
  is_required?: boolean;
  inOrGroup?: boolean;
}

const DataForm = () => {
  const metricsData = useSelector((state: RootState) => state.metrics);
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({});
  const [openSubcategories, setOpenSubcategories] = useState<{ [key: string]: boolean }>({});
  const [highlightedMetric, setHighlightedMetric] = useState<string | null>(null);
  const [requiredMetrics, setRequiredMetrics] = useState<MetricSummary[]>([]);
  const [orGroups, setOrGroups] = useState<MetricSummary[][]>([]);
  const [optionalMetrics, setOptionalMetrics] = useState<MetricSummary[]>([]);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [uploadedNotes, setUploadedNotes] = useState<string>("");
  const [uploadedProposalStatus, setUploadedProposalStatus] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const userAuth = JSON.parse(localStorage.getItem("userAuth") || "{}");
    setIsAdmin(userAuth.is_admin || false);
  }, []);

  useEffect(() => {
    dispatch(updateRowCount());
    return () => {
      dispatch(resetFormState());
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submittedRequests, setSubmittedRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [currentLoadedRequest, setCurrentLoadedRequest] = useState<string>("");
  const [loadedRequestName, setLoadedRequestName] = useState<string>("");
  useEffect(() => {
    if (isAdmin) {
      fetchSubmittedRequests();
    }
  }, [isAdmin]);
  const fetchSubmittedRequests = async () => {
    try {
      setLoadingRequests(true);
      const token = await getCurrentUserToken();
      const requests = await ApiUtils.fetchRequests(token);
      setSubmittedRequests(requests);
    } catch (error) {
      console.error("Error fetching submitted requests:", error);
      dispatch(
        showModal({
          title: "Error",
          message: "Failed to fetch submitted requests.",
          modalType: "error",
        })
      );
    } finally {
      setLoadingRequests(false);
    }
  };
  const handleLoadSubmittedRequest = async (filename: string) => {
    try {
      dispatch(
        showModal({
          title: "Processing",
          message: "Loading request...",
          modalType: "loading",
        })
      );
      const token = await getCurrentUserToken();
      const requestData = await ApiUtils.fetchRequest(filename, token);
      const jsonData = {
        request: requestData.data  
      };
      const restoredState = parseJSONToState(
        jsonData,
        metricsData.behavioralMetrics,
        metricsData.imagingMetrics
      );

      dispatch(restoreStateFromJSON({
        timepoint: restoredState.timepoint,
        behavioral: restoredState.behavioral,
        imaging: restoredState.imaging,
        orGroups: restoredState.orGroups,
        viewMode: restoredState.viewMode,
      }));

      setOrGroups(restoredState.orGroupsSummary);

      setUploadedNotes(restoredState.notes);
      setUploadedProposalStatus(restoredState.proposalStatus);

      await dispatch(updateRowCount()).unwrap();
      setCurrentLoadedRequest(filename);
      setLoadedRequestName(filename);
      dispatch(
        showModal({
          title: "Success",
          message: `Loaded request from ${requestData.name}`,
          modalType: "success",
        })
      );
    } catch (error) {
      console.error("Error loading submitted request:", error);
      dispatch(
        showModal({
          title: "Error",
          message: "Failed to load request. Please try again.",
          modalType: "error",
        })
      );
    }
  };

  useEffect(() => {

    setCurrentLoadedRequest("");
  }, [metricsData.behavioralMetrics, metricsData.imagingMetrics, metricsData.orGroups]);


  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  const handleUploadState = () => {
    fileInputRef.current?.click();
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      dispatch(
        showModal({
          title: "Processing",
          message: "Restoring state from file...",
          modalType: "loading",
        })
      );

      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);


      const restoredState = parseJSONToState(
        jsonData,
        metricsData.behavioralMetrics,
        metricsData.imagingMetrics
      );

      dispatch(restoreStateFromJSON({
        timepoint: restoredState.timepoint,
        behavioral: restoredState.behavioral,
        imaging: restoredState.imaging,
        orGroups: restoredState.orGroups,
        viewMode: restoredState.viewMode,
      }));
      setOrGroups(restoredState.orGroupsSummary);

      setUploadedNotes(restoredState.notes);
      setUploadedProposalStatus(restoredState.proposalStatus);

      dispatch(updateRowCount());

      dispatch(
        showModal({
          title: "Success",
          message: "State restored successfully!",
          modalType: "success",
        })
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error restoring state:", error);
      dispatch(
        showModal({
          title: "Error",
          message: "Failed to restore state. Please check the file format.",
          modalType: "error",
        })
      );
    }
  };
  const handleDownloadState = () => {
    try {
      const hasSelectedMetrics = 
        Object.values(metricsData.behavioralMetrics).some((subcats: any) =>
          Object.values(subcats).some((metrics: any) =>
            metrics.some((m: any) => m.is_selected)
          )
        ) ||
        Object.values(metricsData.imagingMetrics).some((subcats: any) =>
          Object.values(subcats).some((metrics: any) =>
            metrics.some((m: any) => m.is_selected)
          )
        );

      if (!hasSelectedMetrics && (!orGroups || orGroups.length === 0)) {
        dispatch(
          showModal({
            title: "Warning",
            message: "You haven't selected any data!",
            modalType: null,
          })
        );
        return;
      }

      const stateData = createDownloadableState(metricsData, metricsData.timepoint);

      const blob = new Blob([JSON.stringify(stateData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      link.download = `data-request-state-${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      dispatch(
        showModal({
          title: "Success",
          message: "State downloaded successfully!",
          modalType: "success",
        })
      );
    } catch (error) {
      console.error("Error downloading state:", error);
      dispatch(
        showModal({
          title: "Error",
          message: "Failed to download state. Please try again.",
          modalType: "error",
        })
      );
    }
  };
        
  const handleSearchSelect = (category: string, subcategory: string | null, metric: string) => {
    setOpenCategories((prev) => ({ ...prev, [category]: true }));
    if (subcategory) {
      setOpenSubcategories((prev) => ({
        ...prev,
        [`${category}_${subcategory}`]: true,
      }));
    }
    setHighlightedMetric(metric);
    
    setTimeout(() => {
      const elementId = `metric-${metric}`;
      scroller.scrollTo(elementId, {
        duration: 700,
        delay: 0,
        smooth: true,
        offset: -100, 
      });
    }, 400);
    setTimeout(() => setHighlightedMetric(null), 3000); 
  }
  useEffect(() => {
  const required: MetricSummary[] = [];
  const optional: MetricSummary[] = [];

  const collectMetrics = (metricsSource: any, type: string) => {
    Object.entries(metricsSource).forEach(([category, subcategories]: any) => {
      Object.entries(subcategories).forEach(([subcategory, metrics]: any) => {
        metrics.forEach((m: any) => {
          if (m.is_selected) {
            const metricObj: MetricSummary = {
              category,
              subcategory: subcategory === "None" ? undefined : subcategory,
              metricName: m.metric_name,
              displayName: m.name && m.name.toLowerCase() !== "none" ? m.name : m.metric_name,
              type,
              is_required: m.is_required ?? false,
            };
            if (m.is_required) required.push(metricObj);
            else optional.push(metricObj);
          }
        });
      });
    });
  };

  collectMetrics(metricsData.behavioralMetrics, "behavioral");
  collectMetrics(metricsData.imagingMetrics, "imaging");

  const allOrMetrics = new Set(orGroups.flat().map((m) => m.metricName));

  setRequiredMetrics(required);

  setOptionalMetrics(
    optional.filter((m) => !required.some((r) => r.metricName === m.metricName) && !allOrMetrics.has(m.metricName))
  );

  setOrGroups((prevGroups) =>
  prevGroups
    .map((group) =>
      group.filter((g) =>
        optional.some((o) => o.metricName === g.metricName) && !g.is_required
      )
    )
    .filter((g) => g.length > 0)
);
}, [metricsData]);
  return (
    <>
      <div className="mb-3">
      <SearchBar
        allMetrics={{ 
          ...metricsData.behavioralMetrics, 
          ...metricsData.imagingMetrics 
        }}
        onSearchSelect={handleSearchSelect}
      />
    </div>
      {isAdmin && (
        <div className="d-flex align-items-center gap-2 mt-3 mb-2">
        <Button 
          variant="outline-primary" 
          className="mb-2"
          onClick={handleUploadState}
        >
          Upload State
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <Dropdown>
          <Dropdown.Toggle
            variant="outline-primary" 
            id="submitted-requests-dropdown"
            className="d-flex align-items-center"
            style={{
              height: "37px", 
              display: "flex",
              alignItems: "center",
              marginTop: "-8px",
              }}
          >
            {loadingRequests ? "Loading..." : loadedRequestName || "Submitted Requests"}
          </Dropdown.Toggle>

          <Dropdown.Menu style={{ maxHeight: '400px', overflowY: 'auto', minWidth: '300px' }}>
            {submittedRequests.length === 0 ? (
              <Dropdown.Item disabled>No submitted requests found</Dropdown.Item>
            ) : (
              submittedRequests.map((request) => (
                <Dropdown.Item
                  key={request.file_name}
                  onClick={() => handleLoadSubmittedRequest(request.file_name)}
                >
                  <div>
                    {request.file_name}
                  </div>
                </Dropdown.Item>
              ))
            )}
          </Dropdown.Menu>
        </Dropdown>
        {loadedRequestName && (
          <Button
            variant="outline-secondary"
            size="sm"
            className="ms-2"
            onClick={() => {window.location.reload();}}
            title="Clear loaded request"
            style={{ height: "37px", marginTop: "-8px" }}
          >
            <i className="bi bi-x-circle"></i>
          </Button>
        )}
      </div>
      )}
      <TimepointSelection />
      <BehavioralMetricContainer
        openCategories={openCategories}
        openSubcategories={openSubcategories}
        setOpenCategories={setOpenCategories}
        setOpenSubcategories={setOpenSubcategories}
        highlightedMetric={highlightedMetric} />
      <ImagingMetricContainer
        openCategories={openCategories}
        openSubcategories={openSubcategories}
        setOpenCategories={setOpenCategories}
        setOpenSubcategories={setOpenSubcategories}
        highlightedMetric={highlightedMetric} />
      <RecordCount />
      <MetricsLogicSummary
        requiredMetrics={requiredMetrics}
        optionalMetrics={optionalMetrics}
        orGroups={orGroups}
        setRequiredMetrics={setRequiredMetrics}
        setOptionalMetrics={setOptionalMetrics}
        setOrGroups={setOrGroups} />
      <UserDataInputs
        orGroups={orGroups}
        uploadedNotes={uploadedNotes}
        uploadedProposalStatus={uploadedProposalStatus}
      />
      {isAdmin && (
        <div className="d-flex justify-content-between mb-5 mt-3">
          <div className="d-flex justify-content-start">
            {currentLoadedRequest && (
              <Button
                variant="outline-primary"
                className="mr-2"
                onClick={() => navigate(`/request-summary/${currentLoadedRequest}`)}
              >
              View Summary
            </Button>
            )}
          </div>
          <Button variant="outline-primary" onClick={handleDownloadState}>Download State</Button>
        </div>
      )}
    </>
  );
};

export default DataForm;
