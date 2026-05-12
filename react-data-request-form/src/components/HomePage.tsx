import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import LoginModal from "./LoginModal";

const HomePage = () => {
  const navigate = useNavigate();
  const [userAuth, setUserAuth] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        const authData = localStorage.getItem("userAuth");
        if (authData) setUserAuth(JSON.parse(authData));
      } else {
        setUserAuth(null);
      }
    });
    return unsubscribe;
  }, []);


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

        {!isAuthenticated ? (
          <div className="mt-4 mb-3">
            <p className="text-muted mb-4">
              Please login to access the Data Request Form and the Collaborators Console!
            </p>
            <button
              className="btn btn-primary btn-lg px-5 py-3"
              onClick={() => setShowLoginModal(true)}
              style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                background: "#e9ecef",
                border: "1px solid #adb5bd",
                color: "#212529"
              }}
            >
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Login to Get Started
            </button>
          </div>
        ) : (
          <>
            <div className="row justify-content-center mt-3">
              <div
                className="col-5 btn btn-outline-dark d-flex align-items-center justify-content-center text-center border-6"
                onClick={() => navigate("/request-form")}
                style={{ cursor: "pointer", minHeight: "80px" }}
              >
                <p className="my-1">
                  ENIGMA Stroke Recovery Group Data Request Form
                </p>
              </div>
              <div className="col-1"></div>
              <div
                className="col-5 btn btn-outline-dark d-flex align-items-center justify-content-center text-center border-6"
                onClick={() => navigate("/collaborators-directory")}
                style={{ cursor: "pointer", minHeight: "80px" }}
              >
                <p className="m-0">Collaborators Console</p>
              </div>
            </div>
          </>
        )}
      </div>
      <LoginModal 
        show={showLoginModal} 
        onHide={() => setShowLoginModal(false)} 
      />
    </div>
  );
};

export default HomePage;