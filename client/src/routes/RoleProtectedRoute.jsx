import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  getCurrentRole,
  getDefaultRouteForRole,
  isRouteAllowedForRole,
} from "../utils/roleSession";

const RoleProtectedRoute = ({ children }) => {
  const location = useLocation();
  const currentRole = getCurrentRole();

  if (!currentRole) {
    return <Navigate to="/role-switcher" replace />;
  }

  if (!isRouteAllowedForRole(currentRole, location.pathname)) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
