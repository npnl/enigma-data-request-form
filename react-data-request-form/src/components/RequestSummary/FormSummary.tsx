import React, {useEffect, useState} from "react";
import { Container, Row, Col, Card, Spinner, Form, Badge } from "react-bootstrap";
import { DataRequestIn, MetricEntry } from "../../types/DataRequest";
import { styled } from "styled-components";
import ApiUtils from "../../api/ApiUtils";
import { getCurrentUserToken } from "../../services/authService";
import { auth } from "../../firebaseConfig";

interface FormSummaryProps {
  data: DataRequestIn | undefined;
  isLoading: boolean;
}

const FormSummary: React.FC<FormSummaryProps> = ({ data, isLoading }) => {
  const [sessionStats, setSessionStats] = useState<{
    count: number;
    total_sites: number;
    sessions_per_site: { [site: string]: number };
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showAuthors, setShowAuthors] = useState(false);
  const [cohortMembers, setCohortMembers] = useState<{
    [cohort: string]: Array<{
      pi_name: string;
      role: string;
      members: Array<{
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        credit_roles?: string[];
      }>;
    }>;
  }>({});
  const [cohortPIMap, setCohortPIMap] = useState<{ 
    [cohort: string]: Array<{ name: string; role: string }> 
  }>({});
  const StyledCard = styled(Card)`
    margin-bottom: 1rem;
    border: 1px solid #e0e0e0;
  `;

  const StyledCardHeader = styled(Card.Header)`
    padding: 0.75rem 1rem;
    background-color: #f8f9fa;
    font-weight: 600;
  `;

  const StyledCardBody = styled(Card.Body)`
    padding: 1rem;
  `;

  const MetricItem = styled.div`
    padding: 0.25rem 0;
    font-size: 0.95rem;
  `;
  useEffect(() => {
    const fetchPIsAndMembers = async () => {
      try {
        if (!auth.currentUser) {
          await new Promise<void>((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
              if (user) {
                unsubscribe();
                resolve();
              }
            });
          });
        }
        const token = await getCurrentUserToken();
        const piMap = await ApiUtils.fetchPIsByCohort(token);
        setCohortPIMap(piMap);
        const membersMap = await ApiUtils.fetchMembersByCohort(token);
        setCohortMembers(membersMap);
      } catch (error) {
        console.error("Error fetching PI mapping:", error);
      }
    };
    
    fetchPIsAndMembers();
  }, []);
  useEffect(() => {
    const calculateStats = async () => {
      if (!data || !data.data) return;

      try {
        setStatsLoading(true);
        if (!auth.currentUser) {
          await new Promise<void>((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
              if (user) {
                unsubscribe();
                resolve();
              }
            });
          });
        }
        
        const filters = {
          timepoint: data.data.timepoint || "baseline",
          required_metrics: [
            ...(data.data.behavior?.required?.map((m: MetricEntry) => m.metric_name) || []),
            ...(data.data.imaging?.required?.map((m: MetricEntry) => m.metric_name) || []),
          ],
          or_groups: data.data.or_groups?.map((group: any) => 
            group.metrics.map((m: MetricEntry) => m.metric_name)
          ) || [],
        };

        const token = await getCurrentUserToken();
        const response = await ApiUtils.getRowCount(filters, token);
        setSessionStats({
          count: response.count,
          total_sites: response.total_sites,
          sessions_per_site: response.sessions_per_site,
        });
      } catch (error) {
        console.error("Error calculating session stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    calculateStats();
  }, [data]);
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

  const { behavior, imaging, or_groups, timepoint, notes } = data.data;

  const allRequiredMetrics = [
    ...(behavior.required || []),
    ...(imaging.required || []),
  ];

  const allOptionalMetrics = [
    ...(behavior.optional || []),
    ...(imaging.optional || []),
  ];

  const renderMetricText = (metric: MetricEntry) => {
    let displayText = metric.metric_name || metric.display_name;
    
    if (metric.value1 || metric.value2) {
      if (metric.type === "int" || metric.type === "float") {
        if (metric.value1 && metric.value2) {
          displayText += ` (${metric.value1} - ${metric.value2})`;
        } else if (metric.value1) {
          displayText += ` (> ${metric.value1})`;
        } else if (metric.value2) {
          displayText += ` (< ${metric.value2})`;
        }
      } else if (metric.type === "string" && metric.value1) {
        displayText += ` (= ${metric.value1})`;
      }
    }

    return (
      <MetricItem
        key={`${metric.metric_name}-${metric.category}`} 
      >
        {displayText}
      </MetricItem>
    );
  };

  const renderOrGroups = () => (
    or_groups &&
    or_groups.length > 0 && (
      <StyledCard>
        <StyledCardHeader>
          OR Groups
        </StyledCardHeader>
        <StyledCardBody>
          {or_groups.map((group) => (
            <div key={group.group_id} className="mb-3">
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Group {group.group_id}:
              </div>
              <div>
                {group.metrics.map((m) => (
                  <MetricItem key={`${m.metric_name}-${group.group_id}`}>
                    {m.metric_name || m.display_name}
                  </MetricItem>
                ))}
              </div>
            </div>
          ))}
        </StyledCardBody>
      </StyledCard>
    )
  );

  return (
    <Container>
      <h2 className="mt-3 mb-4" style={{ fontWeight: 700 }}>
        Form Summary
      </h2>

      {allRequiredMetrics.length > 0 && (
        <StyledCard>
          <StyledCardHeader>
            Required Metrics
          </StyledCardHeader>
          <StyledCardBody>
            {allRequiredMetrics.map((metric) => renderMetricText(metric))}
          </StyledCardBody>
        </StyledCard>
      )}

      {allOptionalMetrics.length > 0 && (
        <StyledCard>
          <StyledCardHeader>
            Optional Metrics
          </StyledCardHeader>
          <StyledCardBody>
            {allOptionalMetrics.map((metric) => renderMetricText(metric))}
          </StyledCardBody>
        </StyledCard>
      )}

      {renderOrGroups()}
      <Row className="mb-3">
        <Col md={6}>
          <StyledCard>
            <StyledCardBody>
              <strong>Number of session_ids:</strong>{" "}
              {statsLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                sessionStats?.count ?? "N/A"
              )}
            </StyledCardBody>
          </StyledCard>
        </Col>
        <Col md={6}>
          <StyledCard>
            <StyledCardBody>
              <strong>Number of sites:</strong>{" "}
              {statsLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                sessionStats?.total_sites ?? "N/A"
              )}
            </StyledCardBody>
          </StyledCard>
        </Col>
      </Row>

      {sessionStats && sessionStats.sessions_per_site && Object.keys(sessionStats.sessions_per_site).length > 0 && (
        <StyledCard className="mb-3">
          <StyledCardHeader>Session_ids per Site</StyledCardHeader>
          <StyledCardBody>
            <div style={{ fontSize: '0.9rem' }}>
              {Object.entries(sessionStats.sessions_per_site)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([site, count]) => {
                  const piList = cohortPIMap[site] || [];
                  const piDisplay = piList.length > 0 
                    ? ` (${piList.map(p => `${p.name} - ${p.role}`).join(", ")})` 
                    : "";
                  
                  return (
                    <div 
                      key={site} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #f0f0f0',
                        alignItems: 'center'
                      }}
                    >
                      <span>
                        {site}
                        <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                          {piDisplay}
                        </span>
                      </span>
                      <span style={{ fontWeight: 500 }}>{count}</span>
                    </div>
                  );
                })}
            </div>
          </StyledCardBody>
        </StyledCard>
      )}

      {sessionStats && sessionStats.sessions_per_site && Object.keys(sessionStats.sessions_per_site).length > 0 && (
        <StyledCard className="mb-3">
          <StyledCardHeader 
            onClick={() => setShowAuthors(!showAuthors)}
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{showAuthors ? 'Hide Authors' : 'Show Authors'}</span>
            <i className={`bi bi-chevron-${showAuthors ? 'up' : 'down'}`}></i>
          </StyledCardHeader>
          
          {showAuthors && (
            <StyledCardBody>
              {Object.keys(sessionStats.sessions_per_site)
                .sort((a, b) => a.localeCompare(b))
                .map((site) => {
                  const cohortData = cohortMembers[site] || [];
                  
                  if (cohortData.length === 0) {
                    return (
                      <div key={site} className="mb-4">
                        <h6 style={{ fontWeight: 600, color: '#2c3e50', marginBottom: '0.5rem' }}>
                          {site}
                        </h6>
                        <em style={{ color: '#999', fontSize: '0.85rem', marginLeft: '1rem' }}>
                          No contributing members
                        </em>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={site} className="mb-4">
                      <h6 style={{ fontWeight: 600, color: '#2c3e50', marginBottom: '1rem' }}>
                        {site}
                      </h6>
                      
                      {cohortData.map((piData, idx) => (
                        <div key={idx} className="ms-3 mb-3">
                          <div style={{ 
                            fontWeight: 500, 
                            color: '#495057', 
                            marginBottom: '0.5rem' 
                          }}>
                            {piData.pi_name} ({piData.role})
                          </div>
                          
                          <div className="ms-3">
                            {piData.members && piData.members.length > 0 ? (
                              <ul style={{ 
                                margin: 0, 
                                paddingLeft: '1.5rem', 
                                color: '#6c757d', 
                                fontSize: '0.9rem' 
                              }}>
                                {piData.members.map((member, mIdx) => (
                                  <li key={mIdx}>
                                    {member.first_name} {member.last_name}
                                    {member.credit_roles && member.credit_roles.length > 0 && (
                                      <span style={{ 
                                        color: '#999', 
                                        fontSize: '0.85rem',
                                        marginLeft: '0.5rem'
                                      }}>
                                        ({member.credit_roles.join(", ")})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <em style={{ color: '#999', fontSize: '0.85rem' }}>
                                No contributing members
                              </em>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </StyledCardBody>
          )}
        </StyledCard>
      )}

      <StyledCard>
        <StyledCardHeader>Secondary Proposal Status</StyledCardHeader>
        <StyledCardBody>
          {data.data.proposal_status ? (
            <p className="mb-0">{data.data.proposal_status}</p>
          ) : (
            <p className="text-muted mb-0">No status provided.</p>
          )}
        </StyledCardBody>
      </StyledCard>

      {notes && (
        <StyledCard>
          <StyledCardHeader>Notes</StyledCardHeader>
          <StyledCardBody>
            <Form.Control
              as="textarea"
              rows={4}
              value={notes}
              disabled
              style={{ backgroundColor: 'white', border: 'none' }}
            />
          </StyledCardBody>
        </StyledCard>
      )}
    </Container>
  );
};

export default FormSummary;