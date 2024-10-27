import React, { useState } from "react";
import { Button, InputGroup, FormControl } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import { useDispatch, useSelector } from "react-redux";
import ApiUtils from "../api/ApiUtils";
import { showModal, hideModal } from "../redux/modalSlice";
import { RootState } from "../redux/store";
import { DataRequestOut, MetricOut, User } from "../types/DataRequest";
import { Metric, Timepoint } from "../types/MetricsData";

const UserDataInputs: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const metricsData = useSelector((state: RootState) => state.metrics);
  const dispatch = useDispatch();

  const validateEmail = (email: string) => {
    return email.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    checkFormValidity(e.target.value, email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    checkFormValidity(name, e.target.value);
  };

  const checkFormValidity = (name: string, email: string) => {
    const isValidName = name.trim() !== "";
    const isValidEmail = validateEmail(email);
    setIsSubmitEnabled(isValidName && !!isValidEmail);
  };

  const handleSubmit = async () => {
    if (isSubmitEnabled) {
      dispatch(
        showModal({
          title: "Processing",
          message: "Please wait...",
          modalType: "loading",
        })
      );
      // Insert your submit logic here

      let data: DataRequestOut = {
        requestor: { name: name, email: email },
        timepoint: metricsData.timepoint,
        behavior: {},
        imaging: {},
        notes: "",
      };

      data.notes = notes;

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
          const response = await ApiUtils.submitRequest(data);
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
        //   finally {
        //     setTimeout(() => {
        //       dispatch(hideModal());
        //     }, 3000); // Hide the modal after 3 seconds
        //   }
      }
    }
  };

  return (
    <>
      <label className="mb-1 mt-2">
        If you have any additional notes for us, please provide them in the box
        below
      </label>
      <Form.Control
        as="textarea"
        rows={4}
        placeholder="Notes"
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-4 mb-5">
        <InputGroup className="mb-3">
          <InputGroup.Text>Name</InputGroup.Text>
          <FormControl
            placeholder="Enter name"
            aria-label="Enter name"
            value={name}
            onChange={handleNameChange}
          />
        </InputGroup>

        <InputGroup className="mb-3">
          <InputGroup.Text>Email</InputGroup.Text>
          <FormControl
            type="email"
            placeholder="Enter email"
            aria-label="Enter email"
            value={email}
            onChange={handleEmailChange}
          />
        </InputGroup>

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isSubmitEnabled}
        >
          Submit Request
        </Button>
      </div>
    </>
  );
};

export default UserDataInputs;
