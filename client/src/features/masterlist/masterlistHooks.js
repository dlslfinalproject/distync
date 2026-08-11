import { useEffect, useState } from "react";
import { fetchMasterlist } from "./masterlistService";

const emptyData = {
  disasterEvent: null,
  summary: {
    registeredFamilies: 0,
    totalMembers: 0,
    withAttendance: 0,
  },
  rows: [],
};

export const useMasterlist = ({ disasterEventId, barangayId, recordStatus }) => {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadMasterlist = async () => {
      if (!disasterEventId) {
        setData(emptyData);
        setErrorMessage("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await fetchMasterlist({
          disasterEventId,
          barangayId,
          recordStatus,
        });

        if (isMounted) {
          setData(result);
        }
      } catch (error) {
        if (isMounted) {
          setData(emptyData);
          setErrorMessage(error.message || "Failed to load masterlist");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMasterlist();

    return () => {
      isMounted = false;
    };
  }, [barangayId, disasterEventId, recordStatus, reloadKey]);

  return {
    data,
    isLoading,
    errorMessage,
    reloadMasterlist: () => setReloadKey((currentValue) => currentValue + 1),
  };
};
