import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useDispatch } from "react-redux";
import { AppDispatch } from "./redux/store";
import {
  fetchMetrics,
  updateRowCount,
  fetchBooleanData,
} from "./redux/metricsSlice";

import NavBar from "./components/NavBar";
import DataView from "./components/DataView";
import DataForm from "./components/DataForm"; // Correct the path as needed
import RequestsTable from "./components/RequestsTable";
import Modal from "./components/Modal/Modal";
import env from "./config";
import Summary from "./components/RequestSummary/Summary";
import AuthorsList from "./components/AuthorsList";
import QCDataDisplay from "./components/QCTool/QCDataDisplay";
import QCDataTable from "./components/QCTool/QCDataTable";
import CollaboratorsHome from "./components/CollaboratorsConsole/Home";
import Login from "./components/CollaboratorsConsole/Login";
import CompleteSignIn from "./components/CollaboratorsConsole/CompleteSignIn";
import Admins from "./components/CollaboratorsConsole/Admins";
import Collaborators from "./components/CollaboratorsConsole/Collaborators";
import { completeSignIn, getCurrentUser } from "./services/authService";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebaseConfig";
import ApiUtils from "./api/ApiUtils";
import HomePage from "./components/HomePage";

function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchMetrics());
    dispatch(fetchBooleanData());
  }, [dispatch]);

  console.log(env);

  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [isAdmin, setIsAdmin] = useState(false);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const checkIsAdmin = async () => {
      try {
        if (!auth.currentUser) {
          setIsAdmin(false);
        } else {
          const token = await auth.currentUser.getIdToken();
          const response = await ApiUtils.checkCollabAdminStatus(token);
          if (response.is_admin) {
            setIsAdmin(response.is_admin);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    if (!auth.currentUser) {
      setIsAdmin(false);
    } else {
      checkIsAdmin();
    }
  }, [auth.currentUser]);

  // Handle sign-in completion when the app loads
  useEffect(() => {
    const handleSignIn = async () => {
      try {
        await completeSignIn();
      } catch (error) {
        console.error("Error completing sign-in", error);
      }
    };

    handleSignIn();
  }, []);

  return (
    <Router>
      <NavBar isAdmin={isAdmin}/>
      <div className="App mx-3">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/request-form" element={<DataForm />} />
          <Route path="/view-requests" element={<RequestsTable />} />
          <Route path="/request-summary/:fileName" element={<Summary />} />
          <Route path="/view-data" element={<DataView />} />
          <Route path="/view-data/:fileNameParam" element={<DataView />} />
          <Route path="/authors-list" element={<AuthorsList />} />
          <Route path="/qc-tool" element={<QCDataTable />} />
          <Route path="/qc-tool/:bidsId/:sesId" element={<QCDataDisplay />} />
          <Route path="/collaborators-directory" element={<CollaboratorsHome isAdmin={isAdmin} />} />
          <Route path="/collaborators-directory/login" element={<Login />} />
          <Route path="/collaborators-directory/complete-sign-in" element={<CompleteSignIn />} />
          <Route path="/collaborators-directory/admins" element={<Admins />} />
          <Route path="/collaborators-directory/collaborators" element={<Collaborators />} />
        </Routes>
        <Modal />
      </div>
    </Router>
  );
}

export default App;
