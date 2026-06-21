import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Users,
  Home,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  User,
  Key,
  AlertCircle,
} from "lucide-react";

export default function Rentals() {
  const { user, isSuperAdmin } = useAuth();
  const [rentals, setRentals] = useState([]);
  const [filteredRentals, setFilteredRentals] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRental, setEditingRental] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedRental, setExpandedRental] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [propertyOptions, setPropertyOptions] = useState([]);

  // Form fields
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantNid, setTenantNid] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [cottageRoomId, setCottageRoomId] = useState("");
  const [seatsBooked, setSeatsBooked] = useState(1);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dueDay, setDueDay] = useState(1);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  // Status options
  const statusOptions = [
    { id: 1, label: "Active", color: "#22c55e", bg: "#dcfce7" },
    { id: 2, label: "Closed", color: "#6b7280", bg: "#f3f4f6" },
    { id: 3, label: "Notice Period", color: "#f59e0b", bg: "#fef3c7" },
  ];

  async function loadData() {
    setLoading(true);
    try {
      // Load properties first
      const { data: propertyRows, error: propertyError } = await supabase
        .from("properties")
        .select("*, apartment_details(*), cottage_rooms(*)");

      if (propertyError) throw propertyError;
      setProperties(propertyRows ?? []);

      // Extract property options for filter
      const options =
        propertyRows?.map((p) => ({
          id: p.id,
          name: p.name,
        })) || [];
      setPropertyOptions(options);

      // Load rentals with all related data
      const { data: rentalRows, error: rentalError } = await supabase
        .from("rentals")
        .select(
          `
          *,
          tenants(*),
          properties(
            id,
            name,
            address,
            city,
            property_type_id
          ),
          cottage_rooms(
            id,
            room_number,
            seat_capacity,
            seat_cost,
            is_occupied
          ),
          rental_status(name),
          invoices(
            id,
            amount_due,
            due_date,
            is_paid,
            period_start,
            period_end
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (rentalError) throw rentalError;

      // Get payments for each rental
      const rentalsWithPayments = await Promise.all(
        (rentalRows || []).map(async (rental) => {
          const { data: payments } = await supabase
            .from("payments")
            .select("id, amount_paid, paid_at, payment_method")
            .in("invoice_id", rental.invoices?.map((i) => i.id) || []);

          return {
            ...rental,
            payments: payments || [],
          };
        }),
      );

      setRentals(rentalsWithPayments);
      setFilteredRentals(rentalsWithPayments);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load rentals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...rentals];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.tenants?.full_name?.toLowerCase().includes(term) ||
          r.tenants?.phone_number?.includes(term) ||
          r.properties?.name?.toLowerCase().includes(term) ||
          r.cottage_rooms?.room_number?.includes(term),
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status_id === parseInt(filterStatus));
    }

    // Property filter
    if (filterProperty !== "all") {
      filtered = filtered.filter((r) => r.property_id === filterProperty);
    }

    setFilteredRentals(filtered);
  }, [rentals, searchTerm, filterStatus, filterProperty]);

  // Get status info
  function getStatusInfo(statusId) {
    const status = statusOptions.find((s) => s.id === statusId);
    return status || statusOptions[0];
  }

  // Get status icon
  function getStatusIcon(statusId) {
    switch (statusId) {
      case 1:
        return CheckCircle;
      case 2:
        return XCircle;
      case 3:
        return Clock;
      default:
        return Clock;
    }
  }

  // Reset form
  function resetForm() {
    setTenantName("");
    setTenantPhone("");
    setTenantEmail("");
    setTenantNid("");
    setPropertyId("");
    setCottageRoomId("");
    setSeatsBooked(1);
    setMonthlyRent("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setDueDay(1);
    setEditingRental(null);
    setError("");
  }

  // Handle edit
  async function handleEdit(rental) {
    setEditingRental(rental);
    setTenantName(rental.tenants?.full_name || "");
    setTenantPhone(rental.tenants?.phone_number || "");
    setTenantEmail(rental.tenants?.email || "");
    setTenantNid(rental.tenants?.nid_number || "");
    setPropertyId(rental.property_id || "");
    setCottageRoomId(rental.cottage_room_id || "");
    setSeatsBooked(rental.seats_booked || 1);
    setMonthlyRent(rental.monthly_rent || "");
    setStartDate(rental.start_date || "");
    setDueDay(rental.due_day_of_month || 1);
    setShowForm(true);
  }

  // Handle delete
  async function handleDelete(rentalId) {
    if (
      !confirm(
        "Are you sure you want to delete this rental? This will also delete all associated invoices and payments.",
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("rentals")
        .delete()
        .eq("id", rentalId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      setError(error.message);
    }
  }

  // Handle end rental
  async function handleEndRental(rentalId) {
    if (!confirm("Are you sure you want to end this rental?")) return;

    try {
      const { error } = await supabase
        .from("rentals")
        .update({
          status_id: 2, // Closed
          end_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", rentalId);

      if (error) throw error;

      // Mark cottage room as available
      const rental = rentals.find((r) => r.id === rentalId);
      if (rental?.cottage_room_id) {
        await supabase
          .from("cottage_rooms")
          .update({ is_occupied: false })
          .eq("id", rental.cottage_room_id);
      }

      await loadData();
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // 1. Find or create tenant
      let { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("phone_number", tenantPhone)
        .maybeSingle();

      if (!tenant) {
        // IMPORTANT: Add owner_id when creating a new tenant
        const { data: newTenant, error: tenantError } = await supabase
          .from("tenants")
          .insert({
            full_name: tenantName,
            phone_number: tenantPhone,
            email: tenantEmail || null,
            nid_number: tenantNid || null,
            owner_id: user.id, // ← THIS IS THE KEY FIX
          })
          .select()
          .single();

        if (tenantError) throw tenantError;
        tenant = newTenant;
      }

      const isApartment = selectedProperty?.property_type_id === 1;
      const isEditing = !!editingRental;

      const rentalPayload = {
        tenant_id: tenant.id,
        property_id: isApartment ? propertyId : null,
        cottage_room_id: isApartment ? null : cottageRoomId || null,
        seats_booked: isApartment ? 1 : seatsBooked,
        monthly_rent: monthlyRent,
        start_date: startDate,
        due_day_of_month: dueDay,
        status_id: 1, // Active
      };

      let rental;

      if (isEditing) {
        // Update existing rental
        const { data, error: rentalError } = await supabase
          .from("rentals")
          .update(rentalPayload)
          .eq("id", editingRental.id)
          .select()
          .single();

        if (rentalError) throw rentalError;
        rental = data;
      } else {
        // Create new rental
        const { data, error: rentalError } = await supabase
          .from("rentals")
          .insert(rentalPayload)
          .select()
          .single();

        if (rentalError) throw rentalError;
        rental = data;

        // Create first invoice
        const start = new Date(startDate);
        const periodEnd = new Date(start);
        periodEnd.setDate(start.getDate() + 29);
        const dueDate = new Date(start);
        dueDate.setDate(start.getDate() + 30);

        const { error: invoiceError } = await supabase.from("invoices").insert({
          rental_id: rental.id,
          period_start: start.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          due_date: dueDate.toISOString().slice(0, 10),
          amount_due: monthlyRent,
        });

        if (invoiceError) throw invoiceError;

        // Mark cottage room as occupied
        if (!isApartment && cottageRoomId) {
          await supabase
            .from("cottage_rooms")
            .update({ is_occupied: true })
            .eq("id", cottageRoomId);
        }
      }

      setSubmitting(false);
      setShowForm(false);
      resetForm();
      await loadData();
    } catch (error) {
      setError(error.message);
      setSubmitting(false);
    }
  }

  // Clear filters
  function clearFilters() {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterProperty("all");
  }

  // Toggle expand
  function toggleExpand(rentalId) {
    setExpandedRental(expandedRental === rentalId ? null : rentalId);
  }

  // Calculate total paid
  function getTotalPaid(rental) {
    return rental.payments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
  }

  // Calculate outstanding balance
  function getOutstandingBalance(rental) {
    const totalInvoices =
      rental.invoices?.reduce((sum, i) => sum + i.amount_due, 0) || 0;
    const totalPaid = getTotalPaid(rental);
    return totalInvoices - totalPaid;
  }

  return (
    <div className="rentals-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Rentals</h2>
          <p className="subtitle">Manage all rental agreements</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowForm((s) => !s);
          }}
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          {showForm ? "Cancel" : "New Rental"}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search by tenant, property, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className="filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} />
          Filters
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {(filterStatus !== "all" || filterProperty !== "all" || searchTerm) && (
          <button className="clear-filters" onClick={clearFilters}>
            <X size={16} />
            Clear
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Status</label>
            <div className="filter-options">
              <button
                className={filterStatus === "all" ? "active" : ""}
                onClick={() => setFilterStatus("all")}
              >
                All
              </button>
              {statusOptions.map((status) => (
                <button
                  key={status.id}
                  className={filterStatus === String(status.id) ? "active" : ""}
                  onClick={() => setFilterStatus(String(status.id))}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
            >
              <option value="all">All Properties</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-stats">
            <span>{filteredRentals.length} rentals found</span>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form className="rental-form" onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}

          <div className="form-grid">
            <div className="form-section">
              <h4>Tenant Information</h4>
              <label>Full Name</label>
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                placeholder="Enter tenant name"
                className="customInput"
              />
              <label>Phone Number</label>
              <input
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                required
                placeholder="01XXXXXXXXX"
                className="customInput"
              />
              <label>Email</label>{" "}
              <input
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                placeholder="tenant@email.com"
                className="customInput"
              />
              <label>NID Number</label>
              <input
                value={tenantNid}
                onChange={(e) => setTenantNid(e.target.value)}
                placeholder="NID number (optional)"
                className="customInput"
              />
            </div>

            <div className="form-section">
              <h4>Rental Details</h4>

              <label>
                Property
                <select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value);
                    setCottageRoomId("");
                    // Auto-set rent if apartment
                    const prop = properties.find(
                      (p) => p.id === e.target.value,
                    );
                    if (prop?.property_type_id === 1) {
                      setMonthlyRent(
                        prop.apartment_details?.monthly_rent || "",
                      );
                    }
                  }}
                  required
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (
                      {p.property_type_id === 1 ? "Apartment" : "Cottage"})
                    </option>
                  ))}
                </select>
              </label>

              {selectedProperty?.property_type_id === 1 && (
                <div className="property-info">
                  <p className="muted">
                    <DollarSign size={14} />
                    Suggested rent: ৳
                    {selectedProperty.apartment_details?.monthly_rent?.toLocaleString()}
                    /mo
                  </p>
                  {selectedProperty.apartment_details?.area_sqft && (
                    <p className="muted">
                      Area: {selectedProperty.apartment_details.area_sqft} sqft
                    </p>
                  )}
                </div>
              )}

              {selectedProperty?.property_type_id === 2 && (
                <>
                  <label>
                    Room
                    <select
                      value={cottageRoomId}
                      onChange={(e) => {
                        setCottageRoomId(e.target.value);
                        const room = selectedProperty.cottage_rooms?.find(
                          (r) => r.id === e.target.value,
                        );
                        if (room) {
                          setMonthlyRent(room.seat_cost * seatsBooked);
                        }
                      }}
                      required
                    >
                      <option value="">Select room</option>
                      {selectedProperty.cottage_rooms
                        ?.filter(
                          (r) =>
                            !r.is_occupied ||
                            r.id === editingRental?.cottage_room_id,
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number} — {r.seat_capacity} seats — ৳
                            {r.seat_cost}/seat
                            {r.is_occupied && " (Occupied)"}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="grid-2">
                    <label>
                      Seats Booked
                      <input
                        type="number"
                        min="1"
                        max={
                          selectedProperty.cottage_rooms?.find(
                            (r) => r.id === cottageRoomId,
                          )?.seat_capacity || 10
                        }
                        value={seatsBooked}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setSeatsBooked(val);
                          const room = selectedProperty.cottage_rooms?.find(
                            (r) => r.id === cottageRoomId,
                          );
                          if (room) {
                            setMonthlyRent(room.seat_cost * val);
                          }
                        }}
                        required
                      />
                    </label>
                    <label>
                      Rent per seat
                      <input
                        type="number"
                        value={
                          selectedProperty.cottage_rooms?.find(
                            (r) => r.id === cottageRoomId,
                          )?.seat_cost || ""
                        }
                        disabled
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="grid-2">
                <label>
                  Monthly Rent (Total)
                  <input
                    type="number"
                    min="0"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    required
                    placeholder="Total monthly rent"
                  />
                </label>
                <label>
                  Due Day of Month
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                    required
                  />
                </label>
              </div>

              <label>
                Start Date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Reset
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? "Saving..."
                : editingRental
                  ? "Update Rental"
                  : "Create Rental"}
            </button>
          </div>
        </form>
      )}

      {/* Rentals Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading rentals...</p>
        </div>
      ) : (
        <div className="rentals-grid">
          {filteredRentals.map((rental) => {
            const statusInfo = getStatusInfo(rental.status_id);
            const StatusIcon = getStatusIcon(rental.status_id);
            const totalPaid = getTotalPaid(rental);
            const outstanding = getOutstandingBalance(rental);

            return (
              <div className="rental-card" key={rental.id}>
                <div className="rental-card-header">
                  <div className="tenant-info">
                    <User size={16} />
                    <strong>{rental.tenants?.full_name}</strong>
                  </div>
                  <div
                    className="rental-status"
                    style={{
                      backgroundColor: statusInfo.bg,
                      padding: "4px 12px",
                      borderRadius: "12px",
                      color: statusInfo.color,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <StatusIcon size={14} />
                    <span>{statusInfo.label}</span>
                  </div>
                </div>

                <div className="rental-card-body">
                  <div className="property-info">
                    {rental.properties ? (
                      <>
                        <Building2 size={14} />
                        <span>{rental.properties.name}</span>
                        {rental.properties.city && (
                          <span className="city">{rental.properties.city}</span>
                        )}
                      </>
                    ) : (
                      rental.cottage_rooms && (
                        <>
                          <Home size={14} />
                          <span>Room {rental.cottage_rooms.room_number}</span>
                        </>
                      )
                    )}
                  </div>

                  <div className="rental-stats">
                    <div className="stat-item">
                      <DollarSign size={14} />
                      <span>৳{rental.monthly_rent?.toLocaleString()}/mo</span>
                    </div>
                    <div className="stat-item">
                      <Calendar size={14} />
                      <span>Started: {rental.start_date}</span>
                    </div>
                    {rental.seats_booked > 1 && (
                      <div className="stat-item">
                        <Users size={14} />
                        <span>{rental.seats_booked} seats</span>
                      </div>
                    )}
                    {rental.end_date && (
                      <div className="stat-item">
                        <XCircle size={14} />
                        <span>Ended: {rental.end_date}</span>
                      </div>
                    )}
                  </div>

                  <div className="financial-summary">
                    <div className="summary-item">
                      <span className="label">Total Paid</span>
                      <span className="value paid">
                        ৳{totalPaid.toLocaleString()}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Outstanding</span>
                      <span
                        className={`value ${outstanding > 0 ? "outstanding" : "settled"}`}
                      >
                        {outstanding > 0
                          ? `৳${outstanding.toLocaleString()}`
                          : "Settled"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedRental === rental.id && (
                    <div className="rental-expanded">
                      <div className="tenant-details">
                        <h5>Contact Details</h5>
                        <p>
                          <Phone size={14} /> {rental.tenants?.phone_number}
                        </p>
                        {rental.tenants?.email && (
                          <p>
                            <Mail size={14} /> {rental.tenants.email}
                          </p>
                        )}
                        {rental.tenants?.nid_number && (
                          <p>
                            <Key size={14} /> NID: {rental.tenants.nid_number}
                          </p>
                        )}
                      </div>

                      <div className="invoice-summary">
                        <h5>Invoices</h5>
                        {rental.invoices?.length > 0 ? (
                          <div className="invoice-list">
                            {rental.invoices.slice(0, 5).map((inv) => (
                              <div key={inv.id} className="invoice-item">
                                <span className="period">
                                  {inv.period_start} to {inv.period_end}
                                </span>
                                <span className="amount">
                                  ৳{inv.amount_due}
                                </span>
                                <span
                                  className={`status ${inv.is_paid ? "paid" : "unpaid"}`}
                                >
                                  {inv.is_paid ? "Paid" : "Unpaid"}
                                </span>
                              </div>
                            ))}
                            {rental.invoices.length > 5 && (
                              <span className="more">
                                +{rental.invoices.length - 5} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="muted">No invoices yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rental-card-footer">
                  <button
                    className="btn-expand"
                    onClick={() => toggleExpand(rental.id)}
                  >
                    {expandedRental === rental.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                    {expandedRental === rental.id
                      ? "Show Less"
                      : "Show Details"}
                  </button>
                  <div className="rental-actions">
                    {rental.status_id === 1 && (
                      <button
                        className="btn-end"
                        onClick={() => handleEndRental(rental.id)}
                      >
                        <XCircle size={16} />
                        End Rental
                      </button>
                    )}
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(rental)}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(rental.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredRentals.length === 0 && (
            <div className="empty-state">
              <Home size={48} />
              <h3>No rentals found</h3>
              <p>
                {searchTerm ||
                filterStatus !== "all" ||
                filterProperty !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first rental agreement"}
              </p>
              {(searchTerm ||
                filterStatus !== "all" ||
                filterProperty !== "all") && (
                <button className="btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
