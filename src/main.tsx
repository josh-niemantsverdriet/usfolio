import React from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import App from "./App";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./styles.css";
const {
  VITE_AUTH0_DOMAIN: domain,
  VITE_AUTH0_CLIENT_ID: clientId,
  VITE_AUTH0_AUDIENCE: audience,
} = import.meta.env;
function AuthenticatedApp() {
  const auth = useAuth0();
  return (
    <App
      auth={{
        loading: auth.isLoading,
        error: auth.error?.message,
        signedIn: auth.isAuthenticated,
        token: async () => {
          const value = await auth.getAccessTokenSilently();
          if (!value) throw new Error("Please sign in again.");
          return value;
        },
        login: () => {
          void auth.loginWithRedirect({
            appState: { returnTo: location.pathname + location.hash },
          });
        },
        logout: () => {
          void auth.logout({ logoutParams: { returnTo: location.origin } });
        },
      }}
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {domain && clientId && audience ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{ redirect_uri: location.origin, audience }}
        onRedirectCallback={(appState) => {
          history.replaceState({}, "", appState?.returnTo || "/");
        }}
      >
        <AuthenticatedApp />
      </Auth0Provider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
