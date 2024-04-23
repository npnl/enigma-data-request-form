import BehavioralMetricContainer from "./Behavioral/BehavioralSection";
import ImagingMetricContainer from "./Imaging/ImagingSection";
import RecordCount from "./RecordsCount";
import TimepointSelection from "./TimepointSelection";
import env from "../config"
import UserDataInputs from "./UserDataInputs";
import { Button, Form } from "react-bootstrap";

const DataForm = () => {
  return (
    <>
    {env.USER_MODE && env.USER_MODE === 'admin' &&
     <Button variant="outline-primary" className="mt-3 mb-2">
          Upload State
        </Button>}
      <TimepointSelection />
      <BehavioralMetricContainer />
      <ImagingMetricContainer />
      <RecordCount />
      {env.USER_MODE && env.USER_MODE === 'user' && 
       <>
        <UserDataInputs />
      </>}
      {env.USER_MODE && env.USER_MODE === 'admin' && 
      <div className="d-flex justify-content-between mb-5 mt-3">
      <div className="d-flex justify-content-start">
        <Button variant="primary" className="mr-2">
          View Data
        </Button>
        <Button variant="primary">
          Download Data
        </Button>
      </div>
      <Button variant="outline-primary">
          Download State
        </Button>
      </div>}
    </>
  );
};

export default DataForm;