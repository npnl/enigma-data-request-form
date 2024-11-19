import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();
  return (
    <div className="container text-center mt-5 mb-5">
      <h1 className="display-4">
        Welcome to Neural Plasticity and Neurorehabilitation Laboratory!
      </h1>
      <p className="lead mt-3">
        Unlocking the brain's potential with innovation in neurotech — because
        better brains mean better lives!
      </p>
      <div
        style={{
          display: "inline-block",
          backgroundColor: "#ffffff",
          padding: "10px",
          borderRadius: "10px",
        }}
      >
        <img
          src={`${process.env.PUBLIC_URL}/brain-yoga.svg`}
          width="500"
          height="500"
          className="d-inline-block align-top"
          alt="Brain Icon"
        />
        <div className="row justify-content-center">
          <div
            className="col-5 btn btn-outline-dark d-flex align-items-center justify-content-center text-center border-6"
            onClick={() => {
                navigate("/request-form")}}
          >
            <p className="my-1">
              ENIGMA Stroke Recovery Group Data Request Form
            </p>
          </div>
          <div className="col-1"></div>
          <div
            className="col-5 btn btn-outline-dark d-flex align-items-center justify-content-center text-center border-6"
            onClick={() => navigate("/collaborators-directory")}
          >
            <p className="m-0">Collaborators Console</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
