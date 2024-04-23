import React from "react";
import { Container, Row, Col, Card, Spinner, Form } from "react-bootstrap";
import { DataRequestIn, MetricOut } from "../../types/DataRequest";
import { styled } from "styled-components";

interface FormSummaryProps {
  data: DataRequestIn | undefined;
  isLoading: boolean;
}

interface CategorizedMetrics {
  [category: string]: {
    required: { [metricName: string]: MetricOut };
    optional: { [metricName: string]: MetricOut };
  };
}

interface GroupedImaging {
  required: string[];
  optional: string[];
}

const FormSummary: React.FC<FormSummaryProps> = ({ data, isLoading }) => {
  const StyledCard = styled(Card)`
    margin-bottom: 0.5rem;
  `;

  const StyledCardHeader = styled(Card.Header)`
    padding: 0.5rem 1rem;
  `;

  const StyledCardBody = styled(Card.Body)`
    padding: 0.5rem 1rem;
  `;

  const StyledCardText = styled(Card.Text)`
    margin-left: 0.5rem;
    margin-bottom: 0.5rem;
  `;

  const StyledCardTitle = styled(Card.Title)`
    margin-bottom: 0.5rem;
    font-size: 1rem;
  `;

  if (isLoading) {
    return (
      <Container className="text-center">
        <Spinner animation="border" role="status">
          <span className="sr-only">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (!data) {
    return <div>No data to display.</div>;
  }

  const { behavior, imaging, requestor, timepoint, notes } = data.data;

  const groupBehavioralByCategory = (metrics: {
    [key: string]: MetricOut;
  }): CategorizedMetrics => {
    return Object.keys(metrics).reduce<CategorizedMetrics>(
      (acc, metricName) => {
        const metricData = metrics[metricName];

        // Ensure the category structure is initialized
        if (!acc[metricData.category]) {
          acc[metricData.category] = { required: {}, optional: {} };
        }

        // Organize by required or optional, then map by metric name
        if (metricData.required) {
          acc[metricData.category].required[metricName] = metricData;
        } else {
          acc[metricData.category].optional[metricName] = metricData;
        }

        return acc;
      },
      {}
    );
  };

  const groupImaging = (metrics: {
    [key: string]: MetricOut;
  }): GroupedImaging => {
    let grouped: GroupedImaging = { required: [], optional: [] };

    Object.entries(metrics).forEach(([imageName, metric]) => {
      const { required } = metric;

      // Categorize the image based on its requirement
      if (required) {
        grouped.required.push(imageName);
      } else {
        grouped.optional.push(imageName);
      }
    });

    return grouped;
  };

  const behaviorGrouped = groupBehavioralByCategory(behavior);
  const imagingGrouped = groupImaging(imaging);

  const renderMetrics = (metrics: { [metricName: string]: MetricOut }) =>
    Object.entries(metrics).map(([metricName, metric], index) => (
      <StyledCardText className="ml-3" key={`${metricName}-${index}`}>
        {`${metricName} `}
        {metric.value1 || metric.value2 ? ":" : ""}
        {metric.type === "int" || metric.type === "float" ? (
          <>
            {metric.value1 && metric.value2
              ? ` between ${metric.value1} and ${metric.value2}`
              : metric.value1
              ? ` greater than ${metric.value1}`
              : metric.value2 && ` less than ${metric.value2}`}
          </>
        ) : metric.type === "string" ? (
          <span>
            {metric.value1 ? <span>{` == ${metric.value1}`}</span> : ""}
          </span>
        ) : (
          <span>Unknown Type</span>
        )}
      </StyledCardText>
    ));

  const renderCategory = (
    categoryName: string,
    category: {
      required: { [metricName: string]: MetricOut };
      optional: { [metricName: string]: MetricOut };
    }
  ) => (
    <StyledCard className="mb-3">
      <StyledCardHeader>{categoryName}</StyledCardHeader>
      <StyledCardBody>
        {Object.keys(category.required).length > 0 && (
          <>
            <StyledCardTitle>Required</StyledCardTitle>
            {renderMetrics(category.required)}
          </>
        )}
        {Object.keys(category.optional).length > 0 && (
          <>
            <StyledCardTitle>Optional</StyledCardTitle>
            {renderMetrics(category.optional)}
          </>
        )}
      </StyledCardBody>
    </StyledCard>
  );

  return (
    <Container>
    <h2 className="mt-3 mb-3">Form Summary</h2>
      <Row className="mb-2">
        <Col>
          <h4>Behavioral Metrics</h4>
          {Object.entries(behaviorGrouped).map(([categoryName, category]) => (
            <div key={categoryName}>
              {renderCategory(categoryName, category)}
            </div>
          ))}
        </Col>
      </Row>
      {imaging && (
        <Row>
          <Col>
            <h4>Images</h4>
            <StyledCard>
              <StyledCardBody>
                <>
                  <StyledCardTitle>Required</StyledCardTitle>
                  {imagingGrouped.required.map((imageName, idx) => {
                    return (
                      <StyledCardText
                        className="ml-3"
                        key={`${imageName}-${idx}`}
                      >
                        {imageName}
                      </StyledCardText>
                    );
                  })}
                </>
                <>
                  <StyledCardTitle>Optional</StyledCardTitle>
                  {imagingGrouped.optional.map((imageName, idx) => {
                    return (
                      <StyledCardText
                        className="ml-3"
                        key={`${imageName}-${idx}`}
                      >
                        {imageName}
                      </StyledCardText>
                    );
                  })}
                </>
              </StyledCardBody>
            </StyledCard>
          </Col>
        </Row>
      )}
      {notes && (
        <Form.Control
          className="mt-2"
          as="textarea"
          rows={4}
          placeholder="Notes"
          value={notes}
          disabled
        />
      )}
    </Container>
  );
};

export default FormSummary;
