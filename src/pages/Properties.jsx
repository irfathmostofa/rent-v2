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
  Wifi,
  Zap,
  Droplet,
  Flame,
  ParkingCircle,
  Users,
  DollarSign,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  CookingPot,
} from "lucide-react";

const FACILITY_OPTIONS = [
  "water",
  "electricity",
  "wifi",
  "parking",
  "gas",
  "meal",
];
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
  meal: CookingPot,
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
  // (Apartments are rented as a whole unit, so rentals.property_id IS set here — this is fine as-is.)
  const checkApartmentAvailability = async (propertyId) => {
    try {
      const { data, error } = await supabase
        .from("rentals")
        .select("id, status_id, rental_status(name)")
        .eq("property_id", propertyId)
        .eq("status_id", 1)
        .maybeSingle();

      if (error) throw error;
      return !data;
    } catch (error) {
      console.error("Error checking apartment availability:", error);
      return true;
    }
  };

  // Function to get rental/seat status for a property
  // FIX: Cottage rentals are linked via rentals.cottage_room_id, NOT rentals.property_id
  // (property_id is left null for room-based bookings). So we must read the active
  // rentals off each cottage_room itself (room.rentals), not off property.rentals.
  const getPropertyStatus = async (property) => {
    const rooms = property.cottage_rooms || [];

    let totalSeats = 0;
    let occupiedSeats = 0;

    for (const room of rooms) {
      totalSeats += room.seat_capacity || 0;

      const bookedSeats = (room.rentals || [])
        .filter((r) => r.status_id === 1) // only count active rentals
        .reduce((sum, r) => sum + (r.seats_booked || 0), 0);

      occupiedSeats += bookedSeats;
    }

    const availableSeats = Math.max(totalSeats - occupiedSeats, 0);

    if (totalSeats > 0 && availableSeats <= 0) {
      return {
        status: "occupied",
        label: "Fully Occupied",
        availableSeats: 0,
        totalSeats,
      };
    }

    if (occupiedSeats > 0) {
      return {
        status: "partial",
        label: `${availableSeats} seats available`,
        availableSeats,
        totalSeats,
      };
    }

    return {
      status: "available",
      label: "All Available",
      availableSeats: totalSeats,
      totalSeats,
    };
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
    cottage_rooms(*, rentals(id, seats_booked, status_id)),
    property_facilities(
      *,
      facilities(*)
    ),
    rentals(id, status_id)
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

  useEffect(() => {
    let filtered = [...properties];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.address.toLowerCase().includes(term) ||
          (p.city && p.city.toLowerCase().includes(term)),
      );
    }

    if (filterType !== "all") {
      const typeId = filterType === "apartment" ? 1 : 2;
      filtered = filtered.filter((p) => p.property_type_id === typeId);
    }

    if (filterCity !== "all") {
      filtered = filtered.filter((p) => p.city === filterCity);
    }

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

        // Delete and recreate facilities
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
      room_number: r.room_number.trim(),
      seat_capacity: parseInt(r.seat_capacity) || 0,
      seat_cost: parseFloat(r.seat_cost) || 0,
      is_occupied: false, // New rooms start as not occupied
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
    // Get existing rooms to preserve occupancy status
    const { data: existingRooms } = await supabase
      .from("cottage_rooms")
      .select("id, room_number, is_occupied")
      .eq("property_id", propertyId);

    // Create a map of existing room numbers to their data
    const existingRoomsMap = {};
    if (existingRooms) {
      existingRooms.forEach((room) => {
        existingRoomsMap[room.room_number] = {
          id: room.id,
          is_occupied: room.is_occupied,
        };
      });
    }

    // Delete all existing rooms
    await supabase.from("cottage_rooms").delete().eq("property_id", propertyId);

    // Insert updated rooms with preserved occupancy status
    const roomRows = rooms.map((r) => {
      const roomNumber = r.room_number.trim();
      const existing = existingRoomsMap[roomNumber];

      return {
        property_id: propertyId,
        room_number: roomNumber,
        seat_capacity: parseInt(r.seat_capacity) || 0,
        seat_cost: parseFloat(r.seat_cost) || 0,
        // Preserve occupancy status if room existed, otherwise false
        is_occupied: existing ? existing.is_occupied : false,
      };
    });

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
            const occupancyPct =
              p.availability?.totalSeats > 0
                ? Math.round(
                    ((p.availability.totalSeats -
                      p.availability.availableSeats) /
                      p.availability.totalSeats) *
                      100,
                  )
                : 0;

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
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
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

                        {/* Seat occupancy progress bar — clearer at a glance than text alone */}
                        {p.availability?.totalSeats > 0 && (
                          <div className="seat-occupancy">
                            <div className="seat-occupancy-bar">
                              <div
                                className="seat-occupancy-fill"
                                style={{
                                  width: `${occupancyPct}%`,
                                  backgroundColor:
                                    occupancyPct >= 100
                                      ? "#ef4444"
                                      : occupancyPct > 0
                                        ? "#f59e0b"
                                        : "#22c55e",
                                }}
                              />
                            </div>
                            <span className="seat-occupancy-label">
                              {p.availability.availableSeats} of{" "}
                              {p.availability.totalSeats} seats available
                            </span>
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
                            {p.cottage_rooms?.map((r) => {
                              // FIX: read active bookings straight off this room's
                              // own nested `rentals` (joined via cottage_room_id),
                              // not off property.rentals (which only links apartments).
                              const bookedSeats = (r.rentals || [])
                                .filter((x) => x.status_id === 1)
                                .reduce(
                                  (sum, x) => sum + (x.seats_booked || 0),
                                  0,
                                );

                              const availableSeats = Math.max(
                                (r.seat_capacity || 0) - bookedSeats,
                                0,
                              );

                              return (
                                <div key={r.id} className="cottage-room-item">
                                  <span>Room {r.room_number}</span>
                                  <span>
                                    {bookedSeats}/{r.seat_capacity} seats booked
                                  </span>
                                  <span>৳{r.seat_cost}/seat</span>

                                  <span
                                    className={`room-status ${
                                      availableSeats > 0
                                        ? "available"
                                        : "occupied"
                                    }`}
                                  >
                                    {availableSeats > 0
                                      ? `${availableSeats} available`
                                      : "Fully occupied"}
                                  </span>
                                </div>
                              );
                            })}
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
    </div>
  );
}
