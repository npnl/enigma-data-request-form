import React, { useEffect, useState } from "react";
import { sendSignInEmail } from "../../services/authService";
import { auth } from "../../firebaseConfig";
import { useNavigate } from "react-router-dom";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendSignInEmail(email);
      setMessage("A sign-in link has been sent to your email address.");
    } catch (error) {
      console.error("Error sending email link:", error);
      setMessage("Failed to send sign-in link. Please try again.");
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      navigate("/collaborators-directory");
    }
  }, [navigate, auth.currentUser]);

  return (
    <div className="container mt-5">
      <h2>Sign In</h2>
      {message && <div className="alert alert-info">{message}</div>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email address</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary mt-2">
          Send Sign-In Link
        </button>
      </form>
    </div>
  );
};

export default Login;
