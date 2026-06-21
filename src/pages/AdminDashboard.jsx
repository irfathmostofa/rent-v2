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

  async function loadDashboardData() {
    setLoading(true);
    try {
      let propertiesCount = 0;
      let rentalsCount = 0;
      let tenantsCount = 0;

      if (isSuperAdmin) {
        // Super Admin - get all counts
        const [
          { count: allProperties },
          { count: allRentals },
          { count: allTenants },
        ] = await Promise.all([
          supabase
            .from("properties")
            .select("*", { count: "exact", head: true }),
          supabase.from("rentals").select("*", { count: "exact", head: true }),
          supabase.from("tenants").select("*", { count: "exact", head: true }),
        ]);

        propertiesCount = allProperties || 0;
        rentalsCount = allRentals || 0;
        tenantsCount = allTenants || 0;
      } else {
        // Owner - get only their data using direct queries
        // Get owner's properties count
        const { count: propCount } = await supabase
          .from("properties")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id);

        propertiesCount = propCount || 0;

        // Get owner's rentals count (via properties)
        const { data: propertyIds } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id);

        if (propertyIds && propertyIds.length > 0) {
          const propertyIdList = propertyIds.map((p) => p.id);

          // Get rentals count
          const { count: rentalCount } = await supabase
            .from("rentals")
            .select("*", { count: "exact", head: true })
            .in("property_id", propertyIdList);

          rentalsCount = rentalCount || 0;

          // Get tenants count - NOW DIRECTLY FROM TENANTS TABLE WITH owner_id
          const { count: tenantCount } = await supabase
            .from("tenants")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", user.id);

          tenantsCount = tenantCount || 0;
        }
      }

      // Get invoices - with proper filtering
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

      if (!isSuperAdmin) {
        // Get owner's property IDs first
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
            // No rentals, so no invoices
            invoiceQuery = supabase
              .from("invoices")
              .select("*", { count: "exact", head: true })
              .eq("rental_id", "00000000-0000-0000-0000-000000000000");
          }
        } else {
          // No properties, so no invoices
          invoiceQuery = supabase
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .eq("rental_id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { data: invoices } = await invoiceQuery
        .order("due_date", { ascending: false })
        .limit(10);

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

      if (!isSuperAdmin) {
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

      const { data: recentPayments } = await paymentQuery;

      const monthlyRevenue =
        recentPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

      setStats({
        totalProperties: propertiesCount,
        totalRentals: rentalsCount,
        totalTenants: tenantsCount,
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

      if (!isSuperAdmin) {
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

      if (!isSuperAdmin) {
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
            <h3>
              {isSuperAdmin ? "$" : "৳"}
              {stats.monthlyRevenue.toLocaleString()}
            </h3>
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
                <h3>৳{stats.totalRevenue.toLocaleString()}</h3>
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
                        ৳{Number(payment.amount_due).toLocaleString()}
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
              <span className="admin-stat-number">
                {stats.totalProperties > 0 ? "View in Admin" : "0"}
              </span>
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
