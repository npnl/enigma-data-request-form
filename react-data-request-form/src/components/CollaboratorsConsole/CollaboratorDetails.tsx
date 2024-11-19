import React, { useState } from "react";
import { Form, Button, Container, Row, Col, Card } from "react-bootstrap";
import { getCurrentUserToken } from "../../services/authService";
import ApiUtils from "../../api/ApiUtils";

interface CollaboratorDetailsProps {
  handleSubmit: () => void;
  dataFrame: { [key: string]: any };
  action: "add" | "update" | null;
  canDelete: boolean;
}

const CollaboratorDetails: React.FC<CollaboratorDetailsProps> = ({
  handleSubmit,
  dataFrame,
  action,
  canDelete,
}) => {
  const [localDataFrame, setDataFrame] = useState(dataFrame);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = await getCurrentUserToken();
    try {
      if (action === "update"){
              const response = await ApiUtils.updateCollabUserDetails(token, localDataFrame);
      }
      else {
        const response = await ApiUtils.addCollaborator(token, localDataFrame);
      }
      
      handleSubmit();
      console.log(
        `User details ${action === "update" ? "updated" : "added"} successfully`
      );
    } catch (error) {
      console.error(
        `Error ${action === "update" ? "updating" : "adding"} user details:`,
        error
      );
    }
  };

  const handleDelete = async () => {
    const token = await getCurrentUserToken();
    try {
      const response = await ApiUtils.deleteCollaborator(token, [localDataFrame.id]);
      handleSubmit();
      console.log("User details deleted successfully");
    } catch (error) {
      console.error("Error deleting user details:", error);
    }
  };

  return (
    <Container className="mt-4 mb-4">
      <Form onSubmit={handleUpdate}>
        {action === "update" && (
          <Card className="mb-4">
            <Card.Body>
              <Row>
                {["index", "timestamp"]
                  .concat(action === "update" ? ["email"] : [])
                  .map((field, idx) => (
                    <Col md={6} key={idx} className="mb-3">
                      <Form.Group controlId={field}>
                        <Form.Label className="fw-bold text-muted">
                          {field}
                        </Form.Label>
                        <div className="text-secondary">
                          {dataFrame[field] || "N/A"}
                        </div>
                      </Form.Group>
                    </Col>
                  ))}
              </Row>
            </Card.Body>
          </Card>
        )}
        <Card>
          <Card.Body>
            <Row>
              {(action === "add" ? ["email"] : [])
                .concat([
                  "first_name",
                  "last_name",
                  "MI",
                  "status",
                  "PI (if not PI)",
                  "BIDS Site",
                  "Department/Division",
                  "University/Institute",
                  "City",
                  "State/Province",
                  "Country",
                  "Agreement",
                  "Contributions",
                  "Current Contributors",
                  "Former Contributors",
                  "Additional Comments/Q",
                  "Headshot",
                  "Old Emails"
                ])
                .map((field, idx) => (
                  <Col md={6} key={idx} className="mb-4">
                    <Form.Group controlId={field}>
                      <Form.Label className="fw-bold">{field}</Form.Label>
                      <Form.Control
                        type="text"
                        name={field}
                        value={localDataFrame[field] || ""}
                        readOnly={action === "update" && field === "email"}
                        onChange={(e) => {
                          setDataFrame({
                            ...localDataFrame,
                            [field]: e.target.value,
                          });
                        }}
                      />
                    </Form.Group>
                  </Col>
                ))}
            </Row>
          </Card.Body>
        </Card>
        <div className="d-flex justify-content-between mt-4">
          {action === "update" && canDelete && (
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button variant="primary" type="submit">
            Submit
          </Button>
        </div>
      </Form>
    </Container>
  );
};

export { CollaboratorDetails };
