import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessMode, getEntryRouteForMode } from "../utils/accessMode";
import { useAuth } from "../context/AuthContext";
import {
  getDefaultRouteForRole,
  isRouteAllowedForRole,
} from "../utils/roleSession";

const RoleProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessMode, currentRole, isAuthenticated } = useAuth();
  const resolvedAccessMode = accessMode || getAccessMode();

  if (!currentRole) {
    return <Navigate to={getEntryRouteForMode(resolvedAccessMode)} replace />;
  }

  if (
    currentRole !== "DONOR" &&
    !isAuthenticated
  ) {
    return <Navigate to={getEntryRouteForMode(resolvedAccessMode)} replace />;
  }

  if (!isRouteAllowedForRole(currentRole, location.pathname)) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
