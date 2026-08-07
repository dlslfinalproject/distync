import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiFilter, FiMoreHorizontal, FiX } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../features/notifications/notificationService";
import { getNotificationDeepLink } from "../../features/notifications/notificationRouting";
import {
  getNotificationCardMessage,
  getNotificationCategory,
  getNotificationMessage,
  getNotificationMetadata,
  getNotificationPriority,
  getNotificationTypeLabel,
} from "../../features/notifications/notificationPresentation";
import { ROLE_CODES } from "../../utils/roleSession";

const priorityStyles = {
  INFO: { backgroundColor: "#e0f2fe", color: "#075985" },
  WARNING: { backgroundColor: "#fef3c7", color: "#92400e" },
  CRITICAL: { backgroundColor: "#fee2e2", color: "#b91c1c" },
};

const filterTab = (active) => ({
  border: "1px solid #c6d8ea", borderRadius: 12, padding: "10px 14px",
  backgroundColor: active ? "#e1eef9" : "#f8fbfe", color: "#1f4f7d",
  fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 42,
});

const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "--";

const filterStyles = {
  panel: { position: "absolute", top: "calc(100% + 10px)", left: 0, width: "min(360px, calc(100vw - 32px))", backgroundColor: "#fff", border: "1px solid #d6e2ef", borderRadius: 18, boxShadow: "0 18px 36px rgba(31,64,95,.16)", padding: 18, zIndex: 50, display: "grid", gap: 14, boxSizing: "border-box" },
  title: { margin: 0, color: "#17324d", fontSize: 16, fontWeight: 800 },
  field: { display: "grid", gap: 8 },
  label: { color: "#55718b", fontSize: 13, fontWeight: 700 },
  select: { minHeight: 44, borderRadius: 14, border: "1px solid #d0ddeb", backgroundColor: "#fff", color: "#17324d", padding: "10px 12px", fontSize: 14, fontWeight: 600, width: "100%" },
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 4 },
  clear: { border: 0, background: "transparent", color: "#55718b", padding: 2, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 },
  chip: { border: "1px solid #c6d8ea", borderRadius: 999, background: "#f8fbfe", color: "#365472", padding: "7px 9px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 },
};

const NotificationDetail = ({ notification, deepLink, onClose, onOpen }) => {
  if (!notification) return null;

  return <div role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(23,50,77,.35)", display: "flex", justifyContent: "flex-end" }}>
    <section onMouseDown={(event) => event.stopPropagation()} style={{ background: "#fff", width: "min(480px, 100vw)", height: "100%", padding: 24, overflowY: "auto", boxSizing: "border-box" }}>
      <button type="button" onClick={onClose} aria-label="Close notification details" style={{ float: "right", border: 0, background: "transparent", fontSize: 22, cursor: "pointer" }}>×</button>
      <p style={{ margin: 0, color: "#56708a", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{getNotificationTypeLabel(notification)} · {getNotificationCategory(notification)}</p>
      <h2 id="notification-detail-title" style={{ color: "#17324d", margin: "12px 36px 10px 0" }}>{notification.title}</h2>
      <p style={{ color: "#56708a", lineHeight: 1.6 }}>{getNotificationMessage(notification)}</p>
      <dl style={{ display: "grid", gap: 12, margin: "24px 0", color: "#56708a" }}>
        <div><dt style={{ fontWeight: 800 }}>Generated</dt><dd style={{ margin: "3px 0 0" }}>{formatDateTime(notification.generated_at)}</dd></div>
        {getNotificationMetadata(notification).map((row) => <div key={row.label}><dt style={{ fontWeight: 800 }}>{row.label}</dt><dd style={{ margin: "3px 0 0", textTransform: "capitalize" }}>{row.value}</dd></div>)}
      </dl>
      {deepLink?.kind === "destination" ? <button type="button" onClick={onOpen} style={pageHeaderStyles.primaryButton}>{deepLink.label}</button> : null}
    </section>
  </div>;
};

const MayorNotificationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [filters, setFilters] = useState({ category: "ALL", priority: "ALL" });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openOverflowId, setOpenOverflowId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState("");
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [selectedNotification, setSelectedNotification] = useState(null);
  const filterRef = useRef(null);
  const overflowRef = useRef(null);
  const roleDescription = { [ROLE_CODES.MAYOR]: "Review inventory, donation, and system alerts.", [ROLE_CODES.MSWDO]: "Review operational updates for relief coordination.", [ROLE_CODES.BARANGAY]: "Review updates for your barangay operations." };

  const loadNotifications = async (status = statusFilter) => {
    setIsLoading(true);
    setOpenOverflowId("");
    try {
      const response = await fetchNotifications({ status, limit: 50 });
      setNotifications(Array.isArray(response) ? response : []);
    } catch (_error) {
      setToast({ message: "Unable to load notifications. Please try again.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadNotifications(statusFilter); }, [statusFilter]);
  useEffect(() => {
    const fromBell = location.state?.notificationDetail;
    if (fromBell) {
      setSelectedNotification(fromBell);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  useEffect(() => {
    const onUpdate = (event) => {
      const { id, all } = event.detail || {};
      if (all) setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      else if (id) setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    };
    window.addEventListener("distync-notifications-updated", onUpdate);
    return () => window.removeEventListener("distync-notifications-updated", onUpdate);
  }, []);
  useEffect(() => {
    const closeSurfaces = (event) => { if (event.key === "Escape") { setIsFilterOpen(false); setOpenOverflowId(""); } };
    const closeOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterOpen(false);
      if (overflowRef.current && !overflowRef.current.contains(event.target)) setOpenOverflowId("");
    };
    window.addEventListener("keydown", closeSurfaces);
    window.addEventListener("mousedown", closeOutside);
    return () => { window.removeEventListener("keydown", closeSurfaces); window.removeEventListener("mousedown", closeOutside); };
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);
  const categoryOptions = useMemo(() => [...new Set(notifications.map(getNotificationCategory))].sort(), [notifications]);
  const filtered = useMemo(() => notifications.filter((item) => (filters.category === "ALL" || getNotificationCategory(item) === filters.category) && (filters.priority === "ALL" || getNotificationPriority(item) === filters.priority)), [notifications, filters]);
  const activeFilterCount = Number(filters.category !== "ALL") + Number(filters.priority !== "ALL");

  const markRead = async (notification) => {
    if (notification.read_at) return true;
    if (!navigator.onLine) {
      setToast({ message: "Connect to the internet to update this notification.", type: "error" });
      return false;
    }
    setActiveNotificationId(notification.id);
    try {
      await markNotificationAsRead(notification.id);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      window.dispatchEvent(new CustomEvent("distync-notifications-updated", { detail: { id: notification.id } }));
      setToast({ message: "Notification marked as read.", type: "success" });
      return true;
    } catch (_error) {
      setToast({ message: "Unable to update notification. Please try again.", type: "error" });
      return false;
    } finally {
      setActiveNotificationId("");
    }
  };

  const openNotification = async (notification) => {
    if (!(await markRead(notification))) return;
    const link = getNotificationDeepLink(notification, currentRole);
    if (link.kind === "details") setSelectedNotification(notification);
    else navigate(link.to);
  };

  const markAll = async () => {
    if (!unreadCount || !navigator.onLine) return;
    setIsMarkingAllRead(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      window.dispatchEvent(new CustomEvent("distync-notifications-updated", { detail: { all: true } }));
      setToast({ message: "All notifications marked as read.", type: "success" });
    } catch (_error) {
      setToast({ message: "Unable to update notifications. Please try again.", type: "error" });
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const applyFilters = () => { setFilters(draftFilters); setIsFilterOpen(false); };
  const clearFilter = (key) => {
    const next = { ...filters, [key]: "ALL" };
    setFilters(next);
    setDraftFilters(next);
  };

  return <div style={{ width: "100%", maxWidth: 1080, margin: "0 auto", display: "grid", gap: 20, paddingBottom: 28 }}>
    <PageHeader eyebrow="Workspace" title="NOTIFICATIONS" description={roleDescription[currentRole] || "Review your notifications."} actions={[{ label: "Refresh", onClick: () => loadNotifications(statusFilter), variant: "secondary" }, { label: isMarkingAllRead ? "Marking..." : "Mark All as Read", onClick: markAll, disabled: !unreadCount || isMarkingAllRead }]} />
    <section style={{ ...shellStyles.card, padding: 20, display: "grid", gap: activeFilterCount ? 12 : 0 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setStatusFilter("ALL")} style={filterTab(statusFilter === "ALL")}>All</button>
          <button type="button" onClick={() => setStatusFilter("UNREAD")} style={filterTab(statusFilter === "UNREAD")}>Unread</button>
          <div ref={filterRef} style={{ position: "relative" }}>
            <button type="button" onClick={() => { setDraftFilters(filters); setIsFilterOpen((value) => !value); }} aria-haspopup="dialog" aria-expanded={isFilterOpen} style={{ ...pageHeaderStyles.secondaryButton, minHeight: 42, padding: "10px 14px" }}><FiFilter size={16} />{activeFilterCount ? `Filter (${activeFilterCount})` : "Filter"}</button>
            {isFilterOpen ? <div role="dialog" aria-label="Notification filters" style={filterStyles.panel}><h3 style={filterStyles.title}>Filters</h3><label style={filterStyles.field}><span style={filterStyles.label}>Category</span><select value={draftFilters.category} onChange={(event) => setDraftFilters((value) => ({ ...value, category: event.target.value }))} style={filterStyles.select}><option value="ALL">All categories</option>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label style={filterStyles.field}><span style={filterStyles.label}>Priority</span><select value={draftFilters.priority} onChange={(event) => setDraftFilters((value) => ({ ...value, priority: event.target.value }))} style={filterStyles.select}><option value="ALL">All priorities</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Informational</option></select></label><div style={filterStyles.actions}><button type="button" onClick={() => setDraftFilters({ category: "ALL", priority: "ALL" })} style={filterStyles.clear}>Reset</button><button type="button" onClick={applyFilters} style={{ ...pageHeaderStyles.primaryButton, minHeight: 40, padding: "9px 13px" }}>Apply filters</button></div></div> : null}
          </div>
        </div>
        <span style={{ borderRadius: 999, background: "#edf4fb", color: "#24496e", padding: "10px 14px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>Unread: {unreadCount}</span>
      </div>
      {activeFilterCount ? <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{filters.category !== "ALL" ? <button type="button" onClick={() => clearFilter("category")} aria-label={`Remove Category: ${filters.category} filter`} style={filterStyles.chip}>Category: {filters.category}<FiX /></button> : null}{filters.priority !== "ALL" ? <button type="button" onClick={() => clearFilter("priority")} aria-label={`Remove Priority: ${filters.priority} filter`} style={filterStyles.chip}>Priority: {filters.priority === "INFO" ? "Informational" : filters.priority[0] + filters.priority.slice(1).toLowerCase()}<FiX /></button> : null}</div> : null}
    </section>
    <section style={{ ...shellStyles.card, padding: 20 }}>
      {isLoading ? <p style={shellStyles.mutedText}>Loading notifications...</p> : filtered.length === 0 ? <p style={shellStyles.mutedText}>No notifications are available right now.</p> : <div style={{ display: "grid", gap: 12 }}>{filtered.map((notification) => {
        const priority = getNotificationPriority(notification);
        const link = getNotificationDeepLink(notification, currentRole);
        const hasSecondaryAction = !notification.read_at;
        const isMenuOpen = hasSecondaryAction && openOverflowId === notification.id;
        return <article key={notification.id} style={{ border: "1px solid #dbe5ef", borderRadius: 16, padding: 16, background: notification.read_at ? "#fff" : "#f3f8ff", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <span aria-label={notification.read_at ? "Read" : "Unread"} style={{ width: 9, height: 9, marginTop: 7, borderRadius: "50%", background: notification.read_at ? "transparent" : "#2878bf", flexShrink: 0 }} />
          <div style={{ flex: "1 1 420px", minWidth: 0 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span style={{ ...priorityStyles[priority], borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 800 }}>{priority === "INFO" ? "Info" : priority[0] + priority.slice(1).toLowerCase()}</span><span style={{ color: "#56708a", fontSize: 12 }}>{getNotificationTypeLabel(notification)}</span></div><h3 style={{ margin: "8px 0 5px", color: "#17324d", fontSize: 18, fontWeight: notification.read_at ? 700 : 800 }}>{notification.title}</h3><p style={{ margin: 0, color: "#56708a", lineHeight: 1.55 }}>{getNotificationCardMessage(notification)}</p><p style={{ margin: "8px 0 0", color: "#6b8298", fontSize: 12 }}>{formatDateTime(notification.generated_at)}{notification.disaster_event_title ? ` · ${notification.disaster_event_title}` : ""}</p></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", position: "relative" }} ref={isMenuOpen ? overflowRef : null}><button type="button" onClick={() => openNotification(notification)} disabled={activeNotificationId === notification.id} style={{ ...pageHeaderStyles.secondaryButton, minHeight: 42, padding: "10px 14px" }}>{link.label}</button>{hasSecondaryAction ? <><button type="button" onClick={(event) => { event.stopPropagation(); setOpenOverflowId((id) => id === notification.id ? "" : notification.id); }} aria-label="More actions" aria-haspopup="menu" aria-expanded={isMenuOpen} style={{ border: "1px solid #c6d8ea", borderRadius: 12, background: "#f8fbfe", color: "#2a4c6f", minHeight: 42, minWidth: 42, cursor: "pointer" }}><FiMoreHorizontal /></button>{isMenuOpen ? <div role="menu" aria-label="Notification actions" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 150, background: "#fff", border: "1px solid #d6e2ef", borderRadius: 12, boxShadow: "0 12px 24px rgba(31,64,95,.16)", padding: 6 }}><button type="button" role="menuitem" onClick={async (event) => { event.stopPropagation(); setOpenOverflowId(""); await markRead(notification); }} disabled={activeNotificationId === notification.id} style={{ border: 0, background: "transparent", color: "#2a4c6f", width: "100%", padding: "10px 12px", textAlign: "left", cursor: "pointer", fontWeight: 700 }}>Mark as read</button></div> : null}</> : null}</div>
        </article>;
      })}</div>}
    </section>
    <NotificationDetail notification={selectedNotification} deepLink={selectedNotification && getNotificationDeepLink(selectedNotification, currentRole)} onClose={() => setSelectedNotification(null)} onOpen={() => { const link = getNotificationDeepLink(selectedNotification, currentRole); setSelectedNotification(null); navigate(link.to); }} />
    <FeedbackToast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
  </div>;
};

export default MayorNotificationsPage;
