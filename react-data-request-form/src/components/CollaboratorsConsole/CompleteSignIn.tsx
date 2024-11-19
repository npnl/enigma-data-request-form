import React, { useEffect, useState } from "react";
import { completeSignIn } from "../../services/authService";
import { useNavigate } from "react-router-dom";

const CompleteSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const signIn = async () => {
      try {
        console.log("Complete sign in");
        await completeSignIn();
        setMessage("Sign-in successful! Redirecting...");
        navigate("/collaborators-directory");
      } catch (error) {
        console.error("Error completing sign-in:", error);
        setMessage("Failed to complete sign-in. Please try again.");
      }
    };

    signIn();
  }, [navigate]);

  return (
    <div className="container mt-5">
      <h2>{message}</h2>
    </div>
  );
};

export default CompleteSignIn;
