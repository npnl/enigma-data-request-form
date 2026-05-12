import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar, Button } from "react-bootstrap";
import { auth } from "../firebaseConfig";
import { logout } from "../services/authService";

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [selectedItem, setSelectedItem] = useState<string>("Menu");
  const [userAuth, setUserAuth] = useState<any>(null);
  const [, setAuthLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      const authData = localStorage.getItem("userAuth");
      if (authData) {
        setUserAuth(JSON.parse(authData));
      } else {
        setUserAuth(null);
      }
      setAuthLoading(false);
    };
    loadAuth();
  }, [auth.currentUser, location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    if (path === "/") {
      setSelectedItem("Home");
    } else if (path === "/request-form") {
      setSelectedItem("ENIGMA Stroke Recovery Group Data Request Form");
    } else if (path.startsWith("/collaborators-directory")) {
      setSelectedItem("Collaborators Console");
    } else if (path === "/view-requests") {
      setSelectedItem("View Data Requests");
    } else if (path === "/authors-list") {
      setSelectedItem("Authors List");
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem("userAuth");
      setUserAuth(null);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isAuthenticated = !!auth.currentUser;
  const isAdmin = userAuth?.is_admin || false;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <Navbar.Brand as={Link} to="/">
        NPNL{" "}
        <img
          src={`${process.env.PUBLIC_URL}/brain-icon.svg`}
          width="30"
          height="30"
          className="d-inline-block align-top"
          alt="Brain Icon"
        />
      </Navbar.Brand>
      <button
        className="navbar-toggler"
        type="button"
        data-toggle="collapse"
        data-target="#navbarNavDropdown"
        aria-controls="navbarNavDropdown"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon"></span>
      </button>
      <div className="collapse navbar-collapse" id="navbarNavDropdown">
        <ul className="navbar-nav">
          <li className="nav-item dropdown">
            <a
              className="nav-link dropdown-toggle"
              href="#"
              id="navbarDropdownMenuLink"
              role="button"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
            >
              {selectedItem}
            </a>
            <div
              className="dropdown-menu"
              aria-labelledby="navbarDropdownMenuLink"
            >
              {isAuthenticated && (
                <Link
                  className="dropdown-item"
                  to="/"
                  onClick={() => setSelectedItem("Home")}
                >
                  Home
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  className="dropdown-item"
                  to="/request-form"
                  onClick={() =>
                    setSelectedItem(
                      "ENIGMA Stroke Recovery Group Data Request Form"
                    )
                  }
                >
                  ENIGMA Stroke Recovery Group Data Request Form
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  className="dropdown-item"
                  to="/collaborators-directory"
                  onClick={() => setSelectedItem("Collaborators Console")}
                >
                  Collaborators Console
                </Link>
              )}
            
              {isAuthenticated && isAdmin && (
                <>
                  <div className="dropdown-divider"></div>
                  <Link
                    className="dropdown-item"
                    to="/view-requests"
                    onClick={() => setSelectedItem("View Data Requests")}
                  >
                    View Data Requests
                  </Link>
                  <Link
                    className="dropdown-item"
                    to="/authors-list"
                    onClick={() => setSelectedItem("Generate Authors List")}
                  >
                    Authors List
                  </Link>
                </>
              )}
            </div>
          </li>

          {isAuthenticated && isAdmin && (
            <li className="nav-item">
              <Link className="nav-link" to="/admins">
                Admins
              </Link>
            </li>
          )}

        </ul>

        {/* Right-aligned items */}
        <ul className="navbar-nav ml-auto">
          {isAuthenticated && userAuth && (
            <li className="nav-item d-flex align-items-center">
              {/* User info and logout */}
              <span className="text-light me-2 small">
                {auth.currentUser?.email}
              </span>
              
              <Button
                variant="outline-light"
                size="sm"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default NavBar;