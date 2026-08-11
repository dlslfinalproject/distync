-- Keep audit logs for five years.
-- Apply this during maintenance to remove records outside the retention window.

DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '5 years';
