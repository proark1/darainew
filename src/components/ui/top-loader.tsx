import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function TopLoader() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // Show loader briefly on route change
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    loading && (
      <div className="route-top-loader">
        <div className="route-top-loader__bar" />
      </div>
    )
  );
}
