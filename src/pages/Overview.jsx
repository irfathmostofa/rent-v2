import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Home,
  UserPlus,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Overview() {
  const { user, isSuperAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalRentals: 0,
    totalTenants: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingPayments, setUpcomingPayments] = useState([]);

  // Debug logging
  useEffect(() => {
    console.log("=== Overview Debug ===");
    console.log("User:", user?.email);
    console.log("Profile:", profile);
    console.log("Profile role_id:", profile?.role_id);
    console.log("Profile roles:", profile?.roles);
    console.log("isSuperAdmin:", isSuperAdmin);
    console.log("=====================");
  }, [user, profile, isSuperAdmin]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // IMPORTANT: Use isSuperAdmin directly from context
      const isAdmin = isSuperAdmin === true;
      console.log("Loading dashboard - isAdmin:", isAdmin);

      // Get properties count
      let query = supabase
        .from("properties")
        .select("*", { count: "exact", head: true });

      // Only filter if NOT super admin
      if (!isAdmin && user) {
        console.log("Filtering properties for owner:", user.id);
        query = query.eq("owner_id", user.id);
      } else {
        console.log("Super admin - fetching ALL properties");
      }

      const { count: propertiesCount, error: propError } = await query;
      console.log("Properties count:", propertiesCount, "Error:", propError);

      // Get rentals count
      let rentalQuery = supabase
        .from("rentals")
        .select("*", { count: "exact", head: true });

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          rentalQuery = rentalQuery.in(
            "property_id",
            propertyIds.map((p) => p.id),
          );
        } else {
          // If no properties, return 0
          rentalQuery = supabase
            .from("rentals")
            .select("*", { count: "exact", head: true })
            .eq("property_id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: rentalsCount, error: rentalError } = await rentalQuery;
      console.log("Rentals count:", rentalsCount, "Error:", rentalError);

      // Get tenants count (distinct)
      let tenantQuery = supabase
        .from("tenants")
        .select("*", { count: "exact", head: true });

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const { data: rentals } = await supabase
            .from("rentals")
            .select("tenant_id")
            .in(
              "property_id",
              propertyIds.map((p) => p.id),
            );

          if (rentals && rentals.length > 0) {
            const tenantIds = [...new Set(rentals.map((r) => r.tenant_id))];
            tenantQuery = tenantQuery.in("id", tenantIds);
          } else {
            tenantQuery = supabase
              .from("tenants")
              .select("*", { count: "exact", head: true })
              .eq("id", "00000000-0000-0000-0000-000000000000");
          }
        }
      }

      const { count: tenantsCount, error: tenantError } = await tenantQuery;
      console.log("Tenants count:", tenantsCount, "Error:", tenantError);

      // Get invoices
      let invoiceQuery = supabase.from("invoices").select(`
          *,
          rentals(
            id,
            tenant_id,
            tenants(full_name),
            properties(
              id,
              name,
              owner_id
            )
          )
        `);

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const { data: rentals } = await supabase
            .from("rentals")
            .select("id")
            .in(
              "property_id",
              propertyIds.map((p) => p.id),
            );

          if (rentals && rentals.length > 0) {
            invoiceQuery = invoiceQuery.in(
              "rental_id",
              rentals.map((r) => r.id),
            );
          } else {
            invoiceQuery = supabase
              .from("invoices")
              .select("*", { count: "exact", head: true })
              .eq("rental_id", "00000000-0000-0000-0000-000000000000");
          }
        }
      }

      const { data: invoices, error: invoiceError } = await invoiceQuery
        .order("due_date", { ascending: false })
        .limit(10);
      console.log("Invoices count:", invoices?.length, "Error:", invoiceError);

      // Calculate invoice stats
      const totalInvoices = invoices?.length || 0;
      const paidInvoices = invoices?.filter((i) => i.is_paid).length || 0;
      const overdueInvoices =
        invoices?.filter((i) => !i.is_paid && new Date(i.due_date) < new Date())
          .length || 0;
      const totalRevenue =
        invoices
          ?.filter((i) => i.is_paid)
          .reduce((sum, i) => sum + Number(i.amount_due), 0) || 0;

      // Get monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let paymentQuery = supabase
        .from("payments")
        .select("amount_paid, paid_at, invoice_id")
        .gte("paid_at", thirtyDaysAgo.toISOString());

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const { data: rentals } = await supabase
            .from("rentals")
            .select("id")
            .in(
              "property_id",
              propertyIds.map((p) => p.id),
            );

          if (rentals && rentals.length > 0) {
            const { data: invoicesForPayments } = await supabase
              .from("invoices")
              .select("id")
              .in(
                "rental_id",
                rentals.map((r) => r.id),
              );

            if (invoicesForPayments && invoicesForPayments.length > 0) {
              paymentQuery = paymentQuery.in(
                "invoice_id",
                invoicesForPayments.map((i) => i.id),
              );
            }
          }
        }
      }

      const { data: recentPayments, error: paymentError } = await paymentQuery;
      console.log(
        "Payments count:",
        recentPayments?.length,
        "Error:",
        paymentError,
      );

      const monthlyRevenue =
        recentPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

      setStats({
        totalProperties: propertiesCount || 0,
        totalRentals: rentalsCount || 0,
        totalTenants: tenantsCount || 0,
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        totalRevenue,
        monthlyRevenue,
      });

      // Get recent activity
      let activityQuery = supabase
        .from("invoices")
        .select(
          `
          *,
          rentals(
            id,
            tenant_id,
            tenants(full_name),
            properties(
              id,
              name,
              owner_id
            )
          )
        `,
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const { data: rentals } = await supabase
            .from("rentals")
            .select("id")
            .in(
              "property_id",
              propertyIds.map((p) => p.id),
            );

          if (rentals && rentals.length > 0) {
            activityQuery = activityQuery.in(
              "rental_id",
              rentals.map((r) => r.id),
            );
          }
        }
      }

      const { data: recentInvoices } = await activityQuery;

      const activity = [];

      recentInvoices?.forEach((inv) => {
        activity.push({
          id: inv.id,
          type: "invoice",
          title: `Invoice #${inv.id.slice(0, 8)}`,
          description: inv.is_paid ? "Paid" : "Pending",
          date: inv.created_at,
          icon: FileText,
          color: "text-green-600",
        });
      });

      activity.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentActivity(activity.slice(0, 5));

      // Get upcoming payments
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      let upcomingQuery = supabase
        .from("invoices")
        .select(
          `
          *,
          rentals(
            id,
            tenant_id,
            tenants(full_name),
            properties(
              id,
              name,
              owner_id
            )
          )
        `,
        )
        .eq("is_paid", false)
        .gte("due_date", new Date().toISOString().split("T")[0])
        .lte("due_date", nextWeek.toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(5);

      if (!isAdmin && user) {
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const { data: rentals } = await supabase
            .from("rentals")
            .select("id")
            .in(
              "property_id",
              propertyIds.map((p) => p.id),
            );

          if (rentals && rentals.length > 0) {
            upcomingQuery = upcomingQuery.in(
              "rental_id",
              rentals.map((r) => r.id),
            );
          }
        }
      }

      const { data: upcoming } = await upcomingQuery;
      setUpcomingPayments(upcoming || []);

      console.log("Final stats:", {
        totalProperties: propertiesCount,
        totalRentals: rentalsCount,
        totalTenants: tenantsCount,
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        totalRevenue,
        monthlyRevenue,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, [user, isSuperAdmin]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="overview-dashboard">
      {/* Welcome Message */}
      <div className="welcome-section">
        <h2>Welcome back, {profile?.full_name?.split(" ")[0] || "User"}!</h2>
        <p className="welcome-subtitle">
          {isSuperAdmin
            ? "Super Admin Dashboard - Overview of all properties and users"
            : "Here's a summary of your property management activities"}
        </p>
      </div>

      {/* Stats Cards - Different for Owner vs Super Admin */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Building2 size={24} />
          </div>
          <div className="stat-info">
            <h3>{stats.totalProperties}</h3>
            <p>{isSuperAdmin ? "Total Properties" : "Your Properties"}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <h3>{stats.totalRentals}</h3>
            <p>Active Rentals</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <UserPlus size={24} />
          </div>
          <div className="stat-info">
            <h3>{stats.totalTenants}</h3>
            <p>Total Tenants</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon gold">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h3>${stats.monthlyRevenue.toLocaleString()}</h3>
            <p>Monthly Revenue</p>
          </div>
        </div>

        {/* Extra stats for Super Admin */}
        {isSuperAdmin && (
          <>
            <div className="stat-card">
              <div className="stat-icon red">
                <AlertCircle size={24} />
              </div>
              <div className="stat-info">
                <h3>{stats.overdueInvoices}</h3>
                <p>Overdue Invoices</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon teal">
                <CheckCircle size={24} />
              </div>
              <div className="stat-info">
                <h3>${stats.totalRevenue.toLocaleString()}</h3>
                <p>Total Revenue</p>
              </div>
            </div>
          </>
        )}

        {/* Owner specific stat */}
        {!isSuperAdmin && (
          <div className="stat-card">
            <div className="stat-icon red">
              <CreditCard size={24} />
            </div>
            <div className="stat-info">
              <h3>{stats.overdueInvoices}</h3>
              <p>Overdue Invoices</p>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Recent Activity - Shows only relevant activity */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <Link
              to={isSuperAdmin ? "/admin" : "/dashboard/invoices"}
              className="view-all"
            >
              View All →
            </Link>
          </div>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p className="no-data">No recent activity</p>
            ) : (
              recentActivity.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="activity-item">
                    <div className={`activity-icon ${activity.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="activity-content">
                      <p className="activity-title">{activity.title}</p>
                      <span className="activity-desc">
                        {activity.description}
                      </span>
                    </div>
                    <span className="activity-time">
                      {new Date(activity.date).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="dashboard-card payments-card">
          <div className="card-header">
            <h3>Upcoming Payments</h3>
            <Link to="/dashboard/overdue" className="view-all">
              View All →
            </Link>
          </div>
          <div className="payment-list">
            {upcomingPayments.length === 0 ? (
              <p className="no-data">No upcoming payments</p>
            ) : (
              upcomingPayments.slice(0, 5).map((payment) => {
                const daysUntil = Math.ceil(
                  (new Date(payment.due_date) - new Date()) /
                    (1000 * 60 * 60 * 24),
                );
                return (
                  <div key={payment.id} className="payment-item">
                    <div className="payment-info">
                      <span className="payment-tenant">
                        {payment.rentals?.tenants?.full_name || "Unknown"}
                      </span>
                      <span className="payment-amount">
                        ${payment.amount_due}
                      </span>
                    </div>
                    <div className="payment-meta">
                      <span
                        className={`payment-status ${daysUntil <= 2 ? "urgent" : ""}`}
                      >
                        {daysUntil <= 0 ? "Overdue" : `${daysUntil} days`}
                      </span>
                      <span className="payment-date">
                        {new Date(payment.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions - Different for Owner vs Super Admin */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          {!isSuperAdmin ? (
            // Owner actions
            <>
              <Link to="/dashboard/properties" className="quick-action-card">
                <Home size={24} />
                <span>Add Property</span>
              </Link>
              <Link to="/dashboard/rentals" className="quick-action-card">
                <UserPlus size={24} />
                <span>New Rental</span>
              </Link>
              <Link to="/dashboard/invoices" className="quick-action-card">
                <FileText size={24} />
                <span>Create Invoice</span>
              </Link>
              <Link to="/dashboard/messages" className="quick-action-card">
                <Clock size={24} />
                <span>Send Reminder</span>
              </Link>
            </>
          ) : (
            // Super Admin actions
            <>
              <Link to="/admin" className="quick-action-card">
                <Users size={24} />
                <span>Manage Users</span>
              </Link>
              <Link to="/admin" className="quick-action-card">
                <Building2 size={24} />
                <span>All Properties</span>
              </Link>
              <Link to="/admin" className="quick-action-card">
                <AlertCircle size={24} />
                <span>View Reports</span>
              </Link>
              <Link to="/admin" className="quick-action-card">
                <CheckCircle size={24} />
                <span>Verify Users</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Super Admin extra section - Show all owners stats */}
      {isSuperAdmin && (
        <div className="admin-section">
          <h3>Admin Overview</h3>
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <h4>Total Owners</h4>
              <span className="admin-stat-number">View in Admin</span>
              <Link to="/admin" className="admin-stat-link">
                Manage Owners →
              </Link>
            </div>
            <div className="admin-stat-card">
              <h4>System Status</h4>
              <span className="admin-stat-status online">● Online</span>
              <p className="admin-stat-desc">All systems operational</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
