import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Home,
  Building2,
  Bed,
  Bath,
  Wifi,
  Zap,
  Droplet,
  Flame,
  ParkingCircle,
  Users,
  DollarSign,
  MapPin,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

const FACILITY_OPTIONS = ["water", "electricity", "wifi", "parking", "gas"];
const ROOM_TYPE_OPTIONS = [
  "bedroom",
  "bathroom",
  "drawing_room",
  "dining_room",
  "kitchen",
  "balcony",
  "store_room",
  "study_room",
  "servant_room",
  "garage",
];

// Facility icons mapping
const FACILITY_ICONS = {
  water: Droplet,
  electricity: Zap,
  wifi: Wifi,
  parking: ParkingCircle,
  gas: Flame,
};

export default function Properties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [type, setType] = useState("apartment");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [cities, setCities] = useState([]);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [areaSqft, setAreaSqft] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState(0);
  const [apartmentRooms, setApartmentRooms] = useState({});
  const [rooms, setRooms] = useState([
    { room_number: "1", seat_capacity: 4, seat_cost: "" },
  ]);
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [allFacilities, setAllFacilities] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Initialize apartment rooms
  const defaultApartmentRooms = {
    bedroom: { count: 1, included: true },
    bathroom: { count: 1, included: true },
    drawing_room: { count: 0, included: false },
    dining_room: { count: 0, included: false },
    kitchen: { count: 0, included: false },
    balcony: { count: 0, included: false },
    store_room: { count: 0, included: false },
    study_room: { count: 0, included: false },
    servant_room: { count: 0, included: false },
    garage: { count: 0, included: false },
  };

  // Function to check if an apartment is available
  const checkApartmentAvailability = async (propertyId) => {
    try {
      // Check if there's an active rental for this property
      const { data, error } = await supabase
        .from("rentals")
        .select("id, status_id, rental_status(name)")
        .eq("property_id", propertyId)
        .eq("status_id", 1) // 1 = active
        .maybeSingle();

      if (error) throw error;

      // If no active rental found, apartment is available
      return !data;
    } catch (error) {
      console.error("Error checking apartment availability:", error);
      return true; // Default to available if error
    }
  };

  // Function to get rental status for a property
  const getPropertyStatus = async (property) => {
    if (property.property_type_id === 2) {
      // Cottage - check individual room availability
      const rooms = property.cottage_rooms || [];
      const availableRooms = rooms.filter((r) => !r.is_occupied);
      const occupiedRooms = rooms.filter((r) => r.is_occupied);

      if (rooms.length === 0)
        return { status: "unknown", label: "No Rooms", color: "gray" };
      if (availableRooms.length === rooms.length)
        return { status: "available", label: "All Available", color: "green" };
      if (occupiedRooms.length === rooms.length)
        return { status: "occupied", label: "Fully Occupied", color: "red" };
      return {
        status: "partial",
        label: `${availableRooms.length} Available`,
        color: "orange",
      };
    } else {
      // Apartment - check if there's an active rental
      const { data, error } = await supabase
        .from("rentals")
        .select("id, status_id")
        .eq("property_id", property.id)
        .eq("status_id", 1)
        .maybeSingle();

      if (error || !data) {
        return { status: "available", label: "Available", color: "green" };
      }
      return { status: "occupied", label: "Occupied", color: "red" };
    }
  };

  async function loadProperties() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          apartment_details(*),
          apartment_rooms(*, room_types(name)),
          cottage_rooms(*),
          property_facilities(
            *,
            facilities(*)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get availability status for each property
      const propertiesWithStatus = await Promise.all(
        (data || []).map(async (property) => {
          const status = await getPropertyStatus(property);
          return { ...property, availability: status };
        }),
      );

      setProperties(propertiesWithStatus);
      setFilteredProperties(propertiesWithStatus);

      // Extract unique cities for filter
      const uniqueCities = [
        ...new Set(data?.map((p) => p.city).filter(Boolean)),
      ];
      setCities(uniqueCities);
    } catch (error) {
      console.error("Error loading properties:", error);
      setError("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }

  async function loadLookupData() {
    try {
      const [facilitiesRes, roomTypesRes] = await Promise.all([
        supabase.from("facilities").select("*"),
        supabase.from("room_types").select("*"),
      ]);

      if (facilitiesRes.data) setAllFacilities(facilitiesRes.data);
      if (roomTypesRes.data) setRoomTypes(roomTypesRes.data);
    } catch (error) {
      console.error("Error loading lookup data:", error);
    }
  }

  useEffect(() => {
    loadProperties();
    loadLookupData();
  }, []);

  // Apply filters whenever properties, searchTerm, filterType, filterCity, or filterStatus changes
  useEffect(() => {
    let filtered = [...properties];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.address.toLowerCase().includes(term) ||
          (p.city && p.city.toLowerCase().includes(term)),
      );
    }

    // Type filter
    if (filterType !== "all") {
      const typeId = filterType === "apartment" ? 1 : 2;
      filtered = filtered.filter((p) => p.property_type_id === typeId);
    }

    // City filter
    if (filterCity !== "all") {
      filtered = filtered.filter((p) => p.city === filterCity);
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (p) => p.availability?.status === filterStatus,
      );
    }

    setFilteredProperties(filtered);
  }, [properties, searchTerm, filterType, filterCity, filterStatus]);

  function resetForm() {
    setName("");
    setAddress("");
    setCity("");
    setAreaSqft("");
    setMonthlyRent("");
    setSecurityDeposit(0);
    setApartmentRooms({ ...defaultApartmentRooms });
    setRooms([{ room_number: "1", seat_capacity: 4, seat_cost: "" }]);
    setSelectedFacilities([]);
    setType("apartment");
    setEditingProperty(null);
    setError("");
  }

  function handleEdit(property) {
    setEditingProperty(property);
    setType(property.property_type_id === 1 ? "apartment" : "cottage");
    setName(property.name);
    setAddress(property.address);
    setCity(property.city || "");

    if (property.property_type_id === 1) {
      const details = property.apartment_details;
      if (details) {
        setAreaSqft(details.area_sqft || "");
        setMonthlyRent(details.monthly_rent);
        setSecurityDeposit(details.security_deposit || 0);
      }

      // Load apartment rooms
      if (property.apartment_rooms?.length > 0) {
        const roomsMap = { ...defaultApartmentRooms };
        property.apartment_rooms.forEach((ar) => {
          const roomName = ar.room_types?.name;
          if (roomName && roomsMap[roomName]) {
            roomsMap[roomName] = {
              count: ar.count,
              included: true,
            };
          }
        });
        setApartmentRooms(roomsMap);
      }
    } else {
      if (property.cottage_rooms?.length > 0) {
        setRooms(
          property.cottage_rooms.map((r) => ({
            id: r.id,
            room_number: r.room_number,
            seat_capacity: r.seat_capacity,
            seat_cost: r.seat_cost,
          })),
        );
      }
    }

    if (property.property_facilities?.length > 0) {
      const facilityNames = property.property_facilities
        .map((pf) => pf.facilities?.name)
        .filter(Boolean);
      setSelectedFacilities(facilityNames);
    }

    setShowForm(true);
  }

  async function handleDelete(propertyId) {
    if (!confirm("Are you sure you want to delete this property?")) return;

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId);

      if (error) throw error;
      await loadProperties();
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const propertyTypeId = type === "apartment" ? 1 : 2;
    const isEditing = !!editingProperty;

    try {
      let propertyId = editingProperty?.id;

      if (isEditing) {
        // Update property
        const { error: updateError } = await supabase
          .from("properties")
          .update({ name, address, city })
          .eq("id", propertyId);

        if (updateError) throw updateError;

        if (type === "apartment") {
          await handleApartmentUpdate(propertyId);
        } else {
          await handleCottageUpdate(propertyId);
        }

        await supabase
          .from("property_facilities")
          .delete()
          .eq("property_id", propertyId);
      } else {
        const { data: property, error: propError } = await supabase
          .from("properties")
          .insert({
            owner_id: user.id,
            property_type_id: propertyTypeId,
            name,
            address,
            city,
          })
          .select()
          .single();

        if (propError) throw propError;
        propertyId = property.id;

        if (type === "apartment") {
          await handleApartmentCreate(propertyId);
        } else {
          await handleCottageCreate(propertyId);
        }
      }

      if (selectedFacilities.length > 0) {
        const facilityInserts = allFacilities
          .filter((f) => selectedFacilities.includes(f.name))
          .map((f) => ({
            property_id: propertyId,
            facility_id: f.id,
            is_included: true,
          }));

        if (facilityInserts.length > 0) {
          await supabase.from("property_facilities").insert(facilityInserts);
        }
      }

      setSubmitting(false);
      setShowForm(false);
      resetForm();
      await loadProperties();
    } catch (error) {
      setError(error.message);
      setSubmitting(false);
    }
  }

  async function handleApartmentCreate(propertyId) {
    const { error: detailError } = await supabase
      .from("apartment_details")
      .insert({
        property_id: propertyId,
        area_sqft: areaSqft || null,
        monthly_rent: monthlyRent,
        security_deposit: securityDeposit,
      });
    if (detailError) throw detailError;

    const roomInserts = Object.entries(apartmentRooms)
      .filter(([_, data]) => data.included && data.count > 0)
      .map(([roomName, data]) => {
        const roomType = roomTypes.find((rt) => rt.name === roomName);
        return {
          property_id: propertyId,
          room_type_id: roomType?.id,
          count: data.count,
        };
      })
      .filter((r) => r.room_type_id);

    if (roomInserts.length > 0) {
      const { error: roomError } = await supabase
        .from("apartment_rooms")
        .insert(roomInserts);
      if (roomError) throw roomError;
    }
  }

  async function handleCottageCreate(propertyId) {
    const roomRows = rooms.map((r) => ({
      property_id: propertyId,
      room_number: r.room_number,
      seat_capacity: r.seat_capacity,
      seat_cost: r.seat_cost,
    }));
    const { error: roomError } = await supabase
      .from("cottage_rooms")
      .insert(roomRows);
    if (roomError) throw roomError;
  }

  async function handleApartmentUpdate(propertyId) {
    const { data: existingDetails } = await supabase
      .from("apartment_details")
      .select("property_id")
      .eq("property_id", propertyId)
      .single();

    const detailData = {
      area_sqft: areaSqft || null,
      monthly_rent: monthlyRent,
      security_deposit: securityDeposit,
    };

    if (existingDetails) {
      await supabase
        .from("apartment_details")
        .update(detailData)
        .eq("property_id", propertyId);
    } else {
      await supabase
        .from("apartment_details")
        .insert({ property_id: propertyId, ...detailData });
    }

    await supabase
      .from("apartment_rooms")
      .delete()
      .eq("property_id", propertyId);

    const roomInserts = Object.entries(apartmentRooms)
      .filter(([_, data]) => data.included && data.count > 0)
      .map(([roomName, data]) => {
        const roomType = roomTypes.find((rt) => rt.name === roomName);
        return {
          property_id: propertyId,
          room_type_id: roomType?.id,
          count: data.count,
        };
      })
      .filter((r) => r.room_type_id);

    if (roomInserts.length > 0) {
      const { error: roomError } = await supabase
        .from("apartment_rooms")
        .insert(roomInserts);
      if (roomError) throw roomError;
    }
  }

  async function handleCottageUpdate(propertyId) {
    await supabase.from("cottage_rooms").delete().eq("property_id", propertyId);

    const roomRows = rooms.map((r) => ({
      property_id: propertyId,
      room_number: r.room_number,
      seat_capacity: r.seat_capacity,
      seat_cost: r.seat_cost,
    }));
    const { error: roomError } = await supabase
      .from("cottage_rooms")
      .insert(roomRows);
    if (roomError) throw roomError;
  }

  // Helper functions for rooms
  function addRoomRow() {
    setRooms([
      ...rooms,
      {
        room_number: String(rooms.length + 1),
        seat_capacity: 4,
        seat_cost: "",
      },
    ]);
  }

  function updateRoom(i, field, value) {
    const copy = [...rooms];
    copy[i][field] = value;
    setRooms(copy);
  }

  function removeRoom(i) {
    setRooms(rooms.filter((_, idx) => idx !== i));
  }

  function toggleFacility(name) {
    setSelectedFacilities((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name],
    );
  }

  function updateApartmentRoom(roomType, field, value) {
    setApartmentRooms((prev) => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        [field]: field === "count" ? parseInt(value) || 0 : value,
      },
    }));
  }

  function toggleApartmentRoom(roomType) {
    setApartmentRooms((prev) => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        included: !prev[roomType].included,
        count: !prev[roomType].included ? prev[roomType].count || 1 : 0,
      },
    }));
  }

  function toggleExpand(propertyId) {
    setExpandedProperty(expandedProperty === propertyId ? null : propertyId);
  }

  function clearFilters() {
    setSearchTerm("");
    setFilterType("all");
    setFilterCity("all");
    setFilterStatus("all");
  }

  // Get status icon and color
  function getStatusIconAndColor(status) {
    switch (status) {
      case "available":
        return { icon: CheckCircle, color: "#22c55e", bg: "#dcfce7" };
      case "occupied":
        return { icon: XCircle, color: "#ef4444", bg: "#fee2e2" };
      case "partial":
        return { icon: Clock, color: "#f59e0b", bg: "#fef3c7" };
      default:
        return { icon: Clock, color: "#9ca3af", bg: "#f3f4f6" };
    }
  }

  return (
    <div className="properties-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Properties</h2>
          <p className="subtitle">Manage your properties and rooms</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowForm((s) => !s);
          }}
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          {showForm ? "Cancel" : "Add Property"}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search properties..."
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

        {(filterType !== "all" ||
          filterCity !== "all" ||
          filterStatus !== "all" ||
          searchTerm) && (
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
            <label>Property Type</label>
            <div className="filter-options">
              <button
                className={filterType === "all" ? "active" : ""}
                onClick={() => setFilterType("all")}
              >
                All
              </button>
              <button
                className={filterType === "apartment" ? "active" : ""}
                onClick={() => setFilterType("apartment")}
              >
                Apartments
              </button>
              <button
                className={filterType === "cottage" ? "active" : ""}
                onClick={() => setFilterType("cottage")}
              >
                Cottages
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>City</label>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
            >
              <option value="all">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <div className="filter-options">
              <button
                className={filterStatus === "all" ? "active" : ""}
                onClick={() => setFilterStatus("all")}
              >
                All
              </button>
              <button
                className={filterStatus === "available" ? "active" : ""}
                onClick={() => setFilterStatus("available")}
              >
                Available
              </button>
              <button
                className={filterStatus === "occupied" ? "active" : ""}
                onClick={() => setFilterStatus("occupied")}
              >
                Occupied
              </button>
              <button
                className={filterStatus === "partial" ? "active" : ""}
                onClick={() => setFilterStatus("partial")}
              >
                Partial
              </button>
            </div>
          </div>

          <div className="filter-stats">
            <span>{filteredProperties.length} properties found</span>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form className="property-form" onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}

          <div className="form-grid">
            <div className="form-section">
              <h4>Basic Information</h4>
              <div className="type-toggle">
                <button
                  type="button"
                  className={type === "apartment" ? "active" : ""}
                  onClick={() => setType("apartment")}
                  disabled={!!editingProperty}
                >
                  <Building2 size={16} />
                  Apartment
                </button>
                <button
                  type="button"
                  className={type === "cottage" ? "active" : ""}
                  onClick={() => setType("cottage")}
                  disabled={!!editingProperty}
                >
                  <Home size={16} />
                  Cottage
                </button>
              </div>

              <label>Property Name </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Green Valley Apartments"
                className="customInput"
              />

              <label>Address </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                rows={3}
                placeholder="Street address"
                className="customInput"
              />

              <label>City </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="customInput"
              />
            </div>

            <div className="form-section">
              <h4>Details</h4>
              {type === "apartment" ? (
                <>
                  <div className="grid-2">
                    <label>
                      Area (sqft)
                      <input
                        type="number"
                        min="0"
                        value={areaSqft}
                        onChange={(e) => setAreaSqft(e.target.value)}
                        placeholder="e.g., 1200"
                      />
                    </label>
                    <label>
                      Monthly Rent
                      <input
                        type="number"
                        min="0"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        required
                        placeholder="e.g., 15000"
                      />
                    </label>
                    <label>
                      Security Deposit
                      <input
                        type="number"
                        min="0"
                        value={securityDeposit}
                        onChange={(e) => setSecurityDeposit(e.target.value)}
                        placeholder="e.g., 30000"
                      />
                    </label>
                  </div>

                  <div className="apartment-rooms">
                    <label>Rooms</label>
                    <div className="apartment-rooms-grid">
                      {Object.entries(apartmentRooms).map(
                        ([roomName, data]) => (
                          <div key={roomName} className="room-type-row">
                            <label className="room-type-checkbox">
                              <input
                                type="checkbox"
                                checked={data.included}
                                onChange={() => toggleApartmentRoom(roomName)}
                              />
                              <span className="room-type-label">
                                {roomName.replace("_", " ")}
                              </span>
                            </label>
                            {data.included && (
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={data.count}
                                onChange={(e) =>
                                  updateApartmentRoom(
                                    roomName,
                                    "count",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="cottage-rooms">
                  <label>Rooms</label>
                  {rooms.map((room, i) => (
                    <div className="room-row" key={i}>
                      <input
                        placeholder="Room #"
                        value={room.room_number}
                        onChange={(e) =>
                          updateRoom(i, "room_number", e.target.value)
                        }
                        required
                      />
                      <input
                        type="number"
                        placeholder="Seats"
                        min="1"
                        value={room.seat_capacity}
                        onChange={(e) =>
                          updateRoom(i, "seat_capacity", e.target.value)
                        }
                        required
                      />
                      <input
                        type="number"
                        placeholder="Cost/seat"
                        min="0"
                        value={room.seat_cost}
                        onChange={(e) =>
                          updateRoom(i, "seat_cost", e.target.value)
                        }
                        required
                      />
                      {rooms.length > 1 && (
                        <button type="button" onClick={() => removeRoom(i)}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={addRoomRow}
                  >
                    + Add Room
                  </button>
                </div>
              )}

              <div className="facilities-section">
                <label>Facilities</label>
                <div className="facility-chips">
                  {FACILITY_OPTIONS.map((f) => {
                    const Icon = FACILITY_ICONS[f];
                    return (
                      <button
                        key={f}
                        type="button"
                        className={`chip ${selectedFacilities.includes(f) ? "chip-active" : ""}`}
                        onClick={() => toggleFacility(f)}
                      >
                        {Icon && <Icon size={16} />}
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Reset
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? "Saving..."
                : editingProperty
                  ? "Update Property"
                  : "Create Property"}
            </button>
          </div>
        </form>
      )}

      {/* Property Cards */}
      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading properties...</p>
        </div>
      ) : (
        <div className="properties-grid">
          {filteredProperties.map((p) => {
            const statusInfo = getStatusIconAndColor(p.availability?.status);
            const StatusIcon = statusInfo.icon;

            return (
              <div className="property-card" key={p.id}>
                <div className="property-card-header">
                  <div className="property-type-badge">
                    {p.property_type_id === 1 ? (
                      <Building2 size={16} />
                    ) : (
                      <Home size={16} />
                    )}
                    <span>
                      {p.property_type_id === 1 ? "Apartment" : "Cottage"}
                    </span>
                  </div>
                  <div
                    className="property-status"
                    style={{
                      backgroundColor: statusInfo.bg,
                      padding: "4px 12px",
                      borderRadius: "12px",
                      color: statusInfo.color,
                      fontWeight: 600,
                    }}
                  >
                    <StatusIcon size={14} />
                    <span>{p.availability?.label || "Unknown"}</span>
                  </div>
                </div>

                <div className="property-card-body">
                  <h3 className="property-name">{p.name}</h3>
                  <div className="property-location">
                    <MapPin size={14} />
                    <span>
                      {p.address}
                      {p.city ? `, ${p.city}` : ""}
                    </span>
                  </div>

                  <div className="property-stats">
                    {p.property_type_id === 1 ? (
                      <>
                        <div className="stat-item">
                          <DollarSign size={14} />
                          <span>
                            ৳
                            {p.apartment_details?.monthly_rent?.toLocaleString()}
                            /mo
                          </span>
                        </div>
                        {p.apartment_details?.area_sqft && (
                          <div className="stat-item">
                            <span>{p.apartment_details.area_sqft} sqft</span>
                          </div>
                        )}
                        {p.apartment_rooms?.length > 0 && (
                          <div className="stat-item">
                            <Users size={14} />
                            <span>
                              {p.apartment_rooms.reduce(
                                (sum, r) => sum + r.count,
                                0,
                              )}{" "}
                              rooms
                            </span>
                          </div>
                        )}
                        {/* Show rental status for apartment */}
                        {p.availability?.status === "available" && (
                          <div
                            className="stat-item"
                            style={{ color: "#22c55e" }}
                          >
                            <CheckCircle size={14} />
                            <span>Ready for rent</span>
                          </div>
                        )}
                        {p.availability?.status === "occupied" && (
                          <div
                            className="stat-item"
                            style={{ color: "#ef4444" }}
                          >
                            <XCircle size={14} />
                            <span>Currently occupied</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="stat-item">
                          <Users size={14} />
                          <span>{p.cottage_rooms?.length || 0} rooms</span>
                        </div>
                        <div className="stat-item">
                          <span>
                            {p.cottage_rooms?.reduce(
                              (sum, r) => sum + r.seat_capacity,
                              0,
                            )}{" "}
                            seats
                          </span>
                        </div>
                        {p.cottage_rooms && p.cottage_rooms.length > 0 && (
                          <div className="stat-item">
                            <DollarSign size={14} />
                            <span>
                              From ৳
                              {Math.min(
                                ...p.cottage_rooms.map((r) => r.seat_cost),
                              )}
                            </span>
                          </div>
                        )}
                        {/* Show room availability for cottage */}
                        {p.availability?.status === "available" && (
                          <div
                            className="stat-item"
                            style={{ color: "#22c55e" }}
                          >
                            <CheckCircle size={14} />
                            <span>All rooms available</span>
                          </div>
                        )}
                        {p.availability?.status === "partial" && (
                          <div
                            className="stat-item"
                            style={{ color: "#f59e0b" }}
                          >
                            <Clock size={14} />
                            <span>{p.availability?.label}</span>
                          </div>
                        )}
                        {p.availability?.status === "occupied" && (
                          <div
                            className="stat-item"
                            style={{ color: "#ef4444" }}
                          >
                            <XCircle size={14} />
                            <span>Fully occupied</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Facilities */}
                  {p.property_facilities?.length > 0 && (
                    <div className="facility-tags">
                      {p.property_facilities.slice(0, 5).map((pf) => {
                        const Icon = FACILITY_ICONS[pf.facilities?.name];
                        return (
                          <span key={pf.id} className="tag">
                            {Icon && <Icon size={12} />}
                            {pf.facilities?.name}
                          </span>
                        );
                      })}
                      {p.property_facilities.length > 5 && (
                        <span className="tag">
                          +{p.property_facilities.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded details */}
                  {expandedProperty === p.id && (
                    <div className="property-expanded">
                      {p.property_type_id === 1 ? (
                        <div className="room-details">
                          <strong>Room Details:</strong>
                          <div className="room-list">
                            {p.apartment_rooms?.map((ar) => (
                              <span key={ar.id} className="room-badge">
                                {ar.room_types?.name}: {ar.count}
                              </span>
                            ))}
                          </div>
                          {p.apartment_details?.security_deposit > 0 && (
                            <p style={{ marginTop: "8px" }}>
                              Security Deposit: ৳
                              {p.apartment_details.security_deposit}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="room-details">
                          <strong>Room Details:</strong>
                          <div className="cottage-room-list">
                            {p.cottage_rooms?.map((r) => (
                              <div key={r.id} className="cottage-room-item">
                                <span>Room {r.room_number}</span>
                                <span>{r.seat_capacity} seats</span>
                                <span>৳{r.seat_cost}/seat</span>
                                <span
                                  className={`room-status ${r.is_occupied ? "occupied" : "available"}`}
                                >
                                  {r.is_occupied ? "Occupied" : "Available"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="property-card-footer">
                  <button
                    className="btn-expand"
                    onClick={() => toggleExpand(p.id)}
                  >
                    {expandedProperty === p.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                    {expandedProperty === p.id ? "Show Less" : "Show Details"}
                  </button>
                  <div className="property-actions">
                    <button className="btn-edit" onClick={() => handleEdit(p)}>
                      <Edit size={16} />
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProperties.length === 0 && (
            <div className="empty-state">
              <Home size={48} />
              <h3>No properties found</h3>
              <p>
                {searchTerm ||
                filterType !== "all" ||
                filterCity !== "all" ||
                filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first property to get started"}
              </p>
              {(searchTerm ||
                filterType !== "all" ||
                filterCity !== "all" ||
                filterStatus !== "all") && (
                <button className="btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .properties-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .subtitle {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .btn-secondary {
          padding: 8px 16px;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .search-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }

        .search-bar {
          flex: 1;
          min-width: 200px;
          display: flex;
          align-items: center;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 12px;
          transition: all 0.2s;
        }

        .search-bar:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .search-icon {
          color: #9ca3af;
        }

        .search-bar input {
          flex: 1;
          border: none;
          padding: 10px 8px;
          outline: none;
          font-size: 14px;
          background: transparent;
        }

        .filter-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .filter-toggle:hover {
          background: #f9fafb;
        }

        .clear-filters {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }

        .clear-filters:hover {
          background: #fee2e2;
        }

        .filter-panel {
          background: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          align-items: end;
        }

        .filter-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 14px;
          color: #374151;
        }

        .filter-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-options button {
          padding: 6px 14px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .filter-options button:hover {
          background: #f3f4f6;
        }

        .filter-options button.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .filter-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .filter-stats {
          font-size: 14px;
          color: #6b7280;
          padding-top: 8px;
        }

        /* Form Styles */
        .property-form {
          background: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .form-section h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #374151;
        }

        .type-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .type-toggle button {
          flex: 1;
          padding: 10px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .type-toggle button.active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #2563eb;
        }

        .type-toggle button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-section label {
          display: block;
          font-weight: 500;
          margin-bottom: 4px;
          font-size: 14px;
          color: #374151;
        }

        .form-section input[type="text"],
        .form-section input[type="number"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 12px;
          transition: all 0.2s;
        }
.customInput{
 width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 12px;
          transition: all 0.2s;
}
        .form-section input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .apartment-rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 8px;
          margin-top: 8px;
        }

        .room-type-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .room-type-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          flex: 1;
        }

        .room-type-label {
          font-size: 13px;
          text-transform: capitalize;
        }

        .room-type-row input[type="number"] {
          width: 50px;
          padding: 4px 6px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
        }

        .room-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        .room-row input {
          padding: 8px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
        }

        .room-row input:focus {
          outline: none;
          border-color: #2563eb;
        }

        .facility-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          text-transform: capitalize;
        }

        .chip:hover {
          background: #e5e7eb;
        }

        .chip-active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .chip-active:hover {
          background: #1d4ed8;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .error-text {
          color: #dc2626;
          padding: 12px;
          background: #fef2f2;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        /* Property Cards Grid */
        .properties-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        .property-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }

        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .property-card-header {
          padding: 16px 20px;
          background: #f9fafb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e5e7eb;
        }

        .property-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: #e5e7eb;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .property-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .property-card-body {
          padding: 16px 20px;
          flex: 1;
        }

        .property-name {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .property-location {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .property-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          color: #374151;
        }

        .facility-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #f3f4f6;
          border-radius: 12px;
          font-size: 12px;
          color: #374151;
        }

        .property-expanded {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
        }

        .room-details strong {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .room-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }

        .room-badge {
          padding: 4px 10px;
          background: #eff6ff;
          border-radius: 12px;
          font-size: 12px;
          color: #2563eb;
        }

        .cottage-room-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cottage-room-item {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 8px;
          padding: 6px 10px;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 13px;
          align-items: center;
        }

        .room-status {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        .room-status.available {
          background: #dcfce7;
          color: #22c55e;
        }

        .room-status.occupied {
          background: #fee2e2;
          color: #ef4444;
        }

        .property-card-footer {
          padding: 12px 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-expand {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        .btn-expand:hover {
          color: #374151;
        }

        .property-actions {
          display: flex;
          gap: 8px;
        }

        .btn-edit, .btn-delete {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-edit {
          background: #eff6ff;
          color: #2563eb;
        }

        .btn-edit:hover {
          background: #dbeafe;
        }

        .btn-delete {
          background: #fef2f2;
          color: #dc2626;
        }

        .btn-delete:hover {
          background: #fee2e2;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .empty-state h3 {
          margin: 16px 0 8px;
          color: #374151;
        }

        .empty-state button {
          margin-top: 16px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .loader {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #2563eb;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .properties-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .page-header h2 {
            font-size: 24px;
          }

          .search-filters {
            flex-direction: column;
            align-items: stretch;
          }

          .search-bar {
            width: 100%;
          }

          .filter-panel {
            grid-template-columns: 1fr;
          }

          .properties-grid {
            grid-template-columns: 1fr;
          }

          .grid-2 {
            grid-template-columns: 1fr;
          }

          .room-row {
            grid-template-columns: 1fr 1fr;
          }

          .room-row input:last-child {
            grid-column: 1 / -1;
          }

          .property-stats {
            flex-direction: column;
            gap: 4px;
          }

          .property-card-footer {
            flex-direction: column;
          }

          .property-actions {
            width: 100%;
          }

          .property-actions button {
            flex: 1;
            justify-content: center;
          }

          .cottage-room-item {
            grid-template-columns: 1fr 1fr;
            gap: 4px;
          }

          .apartment-rooms-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 480px) {
          .apartment-rooms-grid {
            grid-template-columns: 1fr;
          }

          .type-toggle {
            flex-direction: column;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
