import { auth } from "../firebaseConfig";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  User,
} from "firebase/auth";

const actionCodeSettings = {
  url: window.location.origin + "/collaborators-directory/complete-sign-in",
  handleCodeInApp: true,
};

export const sendSignInEmail = async (email: string) => {
  //console.log(actionCodeSettings)
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", email);
};

export const completeSignIn = async () => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem("emailForSignIn");

    if (!email) {
      email = window.prompt("Please provide your email for confirmation") || "";
    }

    try {
      const result = await signInWithEmailLink(
        auth,
        email,
        window.location.href
      );
      window.localStorage.removeItem("emailForSignIn");
      return result.user;
    } catch (error) {
      console.error("Error signing in with email link", error);
      throw error;
    }
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const getCurrentUserToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error("Error getting ID token", error);
      return null;
    }
  }
  return null;
};
