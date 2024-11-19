import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import env from "../config";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

interface NavBarProps {
  isAdmin: boolean;
}

const NavBar: React.FC<NavBarProps> = ({ isAdmin }) => {
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<string>("Menu");
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/collaborators-directory/login");
  };

  const location = useLocation();

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
        {/* Left-aligned navigation items */}
        <ul className="navbar-nav">
          {/* Dropdown menu */}
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
              <Link
                className="dropdown-item"
                to="/collaborators-directory"
                onClick={() => setSelectedItem("Collaborators Console")}
              >
                Collaborators console
              </Link>
              {env.USER_MODE && env.USER_MODE === "admin" && (
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
                    to="/qc-tool"
                    onClick={() => setSelectedItem("Quality Control GBH Data")}
                  >
                    Quality Control GBH Data
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

          {location.pathname.match("/collaborators-directory*") &&
            auth.currentUser &&
            isAdmin && (
              <>
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    to="/collaborators-directory/admins"
                  >
                    Admins
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    to="/collaborators-directory/collaborators"
                  >
                    Collaborators
                  </Link>
                </li>
              </>
            )}
        </ul>

        {location.pathname.match("/collaborators-directory*") &&
          auth.currentUser && (
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link
                  className="nav-link"
                  onClick={handleLogout}
                  to="/collaborators-directory/login"
                >
                  Logout
                </Link>
              </li>
            </ul>
          )}
      </div>
    </nav>
  );
};

export default NavBar;
