BEGIN;

-- DISTYNC uses the Express API and its trusted postgres pool for application
-- data access.  Remove the unused direct table/view capabilities from the
-- ordinary Supabase database roles while preserving postgres and service_role.
REVOKE ALL PRIVILEGES ON TABLE public.anomaly_reviews FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.barangays FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.default_emergency_donation_needs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.devices FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.disaster_event_barangays FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.disaster_event_code_counters FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.disaster_events FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.distribution_transaction_items FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.distribution_transaction_relief_pack_templates FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.distribution_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.donation_items FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.donation_needs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.donations FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.error_logs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.evacuation_centers FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.evacuation_logs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.evacuee_sectors FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.evacuees FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.forecast_results FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.forecast_runs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.household_privacy_consents FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.household_sectors FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.households FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_batches FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_domain_effect_intents FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_item_stock_forms FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_items FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_transaction_reference_counters FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_delivery_states FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_email_deliveries FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_recipients FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_rule_role_policies FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_rules FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notification_summary_events FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.permissions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.relief_pack_template_disaster_types FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.relief_pack_template_items FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.relief_pack_templates FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.role_permissions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.roles FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sectors FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stub_donated_relief_pack_assignments FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stubs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sync_conflicts FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sync_transactions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_role_settings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_roles FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.donation_transparency_summary FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.public_donation_summary FROM anon, authenticated;

-- Existing public functions are only used by the trusted backend, triggers,
-- or the RLS event-trigger mechanism.  Function EXECUTE for postgres and
-- service_role is intentionally preserved.
REVOKE EXECUTE ON FUNCTION public.assign_inventory_transaction_reference_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_disaster_event_code_safe(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_inventory_batch_stock_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_distribution_receipt_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_stub_qr_code_value() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_set_disaster_event_code_safe() FROM PUBLIC, anon, authenticated;

-- All current DISTYNC public application objects are created under postgres.
-- supabase_admin defaults were intentionally not changed: that managed role
-- owns no current DISTYNC public object and the verified postgres migration
-- identity is not authorized to alter its defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
