import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessMode, getEntryRouteForMode } from "../utils/accessMode";
import {
  getCurrentRole,
  getDefaultRouteForRole,
  isRouteAllowedForRole,
} from "../utils/roleSession";

const RoleProtectedRoute = ({ children }) => {
  const location = useLocation();
  const currentRole = getCurrentRole();
  const accessMode = getAccessMode();

  if (!currentRole) {
    return <Navigate to={getEntryRouteForMode(accessMode)} replace />;
  }

  if (!isRouteAllowedForRole(currentRole, location.pathname)) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
