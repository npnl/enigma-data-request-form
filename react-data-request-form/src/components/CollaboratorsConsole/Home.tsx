import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebaseConfig";
import Collaborators from "./Collaborators";
import { CollaboratorDetails } from "./CollaboratorDetails";
import { getCurrentUserToken } from "../../services/authService";
import ApiUtils from "../../api/ApiUtils";

interface HomeProps {
  isAdmin: boolean;
}

const CollaboratorsHome: React.FC<HomeProps> = ({ isAdmin }) => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState<{ [key: string]: any } | null>(
    null
  );

  const fetchUserDetails = async () => {
    const token = await getCurrentUserToken();
    if (token) {
      try {
        const response = await ApiUtils.fetchCollabUserDetails(token);
        setUserDetails(response);
      } catch (error) {
        console.error("Error fetching user details", error);
      } finally {
      }
    } else {
      console.error("No ID token available");
    }
  };

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/collaborators-directory/login");
    }
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/collaborators-directory/login");
    } else {
      fetchUserDetails();
    }
  }, [auth.currentUser]);
  console.log(isAdmin)
  return (
    <div>
      {isAdmin ? (
        <Collaborators />
      ) : (
        userDetails && (
          <CollaboratorDetails
            handleSubmit={() => {}}
            dataFrame={userDetails}
            action="update"
            canDelete={false}
          />
        )
      )}
    </div>
  );
};

export default CollaboratorsHome;
