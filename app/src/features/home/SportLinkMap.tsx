/**
 * SportLinkMap.tsx
 * Bản đồ Leaflet thật – tích hợp ghim cơ sở sân mẹ, ghim vị trí bản thân (GPS),
 * popup thông tin và tính khoảng cách Haversine.
 * Yêu cầu: leaflet + react-leaflet + @types/leaflet đã được cài.
 */
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router';
import { formatCurrency } from '../../shared/utils/format';

// --- Fix icon mặc định của Leaflet bị mất khi dùng với Vite/Webpack ---
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Tạo custom DivIcon cho ghim cơ sở sân ---
function createFacilityIcon(isSelected: boolean, label: string): L.DivIcon {
  const abbr = label.replace(/[^\u00C0-\u024F\u1E00-\u1EFF\w\s]/gi, '')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const size = isSelected ? 46 : 38;
  const bgColor = isSelected ? '#000' : '#1a1a1a';
  const border = isSelected ? '3px solid #fff' : '2.5px solid #fff';
  const boxShadow = isSelected
    ? '0 4px 20px rgba(0,0,0,0.5), 0 0 0 4px rgba(0,0,0,0.15)'
    : '0 2px 10px rgba(0,0,0,0.35)';
  const fontSize = isSelected ? '11px' : '10px';

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${bgColor};color:#fff;
        border:${border};box-shadow:${boxShadow};
        display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:${fontSize};font-family:sans-serif;
        letter-spacing:-0.3px;user-select:none;
        transition:all 0.2s ease;
      ">${abbr}</div>
    `,
  });
}

// --- Tạo custom DivIcon cho ghim vị trí bản thân ---
function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(37,99,235,0.3);
          animation:sportlink-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
        "></div>
        <div style="
          position:relative;width:36px;height:36px;border-radius:50%;
          background:#1d4ed8;color:#fff;
          border:3px solid #fff;
          box-shadow:0 2px 12px rgba(29,78,216,0.5),0 0 0 3px rgba(29,78,216,0.2);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
        ">◎</div>
      </div>
      <style>
        @keyframes sportlink-ping {
          0%{transform:scale(1);opacity:.8}
          75%,100%{transform:scale(2.2);opacity:0}
        }
      </style>
    `,
  });
}

// --- Haversine distance ---
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// --- Chip môn thể thao đơn giản (không dùng SVG icon) ---
function SportChip({ name }: { name: string }) {
  const abbrevMap: Record<string, string> = {
    'bóng đá': 'Bóng đá',
    'football': 'Bóng đá',
    'cầu lông': 'Cầu lông',
    'badminton': 'Cầu lông',
    'pickleball': 'Pickleball',
    'tennis': 'Tennis',
    'quần vợt': 'Tennis',
    'bóng rổ': 'Bóng rổ',
    'basketball': 'Bóng rổ',
    'bóng chuyền': 'Bóng chuyền',
    'volleyball': 'Bóng chuyền',
  };
  const key = name.toLowerCase();
  const label = abbrevMap[key] ?? name;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: '5px',
      background: '#111',
      color: '#fff',
      fontSize: '10px',
      fontWeight: 700,
      marginRight: '3px',
      marginBottom: '3px',
      lineHeight: 1.5,
    }}>
      {label}
    </span>
  );
}

// --- Sub-component để lắng nghe sự kiện map click (focus facility) ---
function MapController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom: number | null;
}) {
  const map = useMap();
  const prevCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (
      center &&
      zoom &&
      (prevCenter.current === null ||
        prevCenter.current[0] !== center[0] ||
        prevCenter.current[1] !== center[1])
    ) {
      map.flyTo(center, zoom, { animate: true, duration: 0.9 });
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

// --- Interface kiểu dữ liệu cơ sở ---
export interface FacilitySeedItem {
  facility_id: number;
  name: string;
  address: string;
  total_courts: number;
  min_price: number;
  max_price: number;
  sports: string[];
  lat: number;
  lng: number;
  images: string;
}

interface SportLinkMapProps {
  facilities: FacilitySeedItem[];
  selectedFacilityId: number | null;
  onSelectFacility: (id: number) => void;
}

export default function SportLinkMap({
  facilities,
  selectedFacilityId,
  onSelectFacility,
}: SportLinkMapProps) {
  const [userLatLng, setUserLatLng] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(
    null,
  );
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());

  // Trung tâm bản đồ TP. Thủ Đức
  const DEFAULT_CENTER: [number, number] = [10.855, 106.782];
  const DEFAULT_ZOOM = 13;

  // Khi chọn facility từ cột trái → fly đến vị trí đó + mở popup
  useEffect(() => {
    if (selectedFacilityId == null) return;
    const fac = facilities.find((f) => f.facility_id === selectedFacilityId);
    if (!fac) return;
    setFlyTarget({ center: [fac.lat, fac.lng], zoom: 15 });
    // Mở popup
    const marker = markerRefs.current.get(fac.facility_id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 950);
    }
  }, [selectedFacilityId, facilities]);

  // Định vị GPS người dùng
  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocMsg('Trình duyệt không hỗ trợ GPS.');
      return;
    }
    setIsLocating(true);
    setLocMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLatLng(latlng);
        setFlyTarget({ center: latlng, zoom: 15 });
        setLocMsg('Đã xác định vị trí của bạn!');
        setTimeout(() => setLocMsg(null), 4000);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        setLocMsg('Không lấy được vị trí. Vui lòng cho phép truy cập GPS trong trình duyệt.');
        setTimeout(() => setLocMsg(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const userIcon = createUserIcon();

  return (
    <div className="flex flex-col gap-0">
      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
          <span className="text-sm font-black text-gray-900">
            Bản đồ Cụm Sân Thể Thao ({facilities.length} cơ sở)
          </span>
        </div>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="px-3 py-1.5 rounded-lg bg-black hover:bg-gray-800 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path strokeWidth="2" strokeLinecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <span>{isLocating ? 'Đang dò GPS...' : 'Vị trí của tôi'}</span>
        </button>
      </div>

      {/* Thông báo GPS */}
      {locMsg && (
        <div className="mt-2 py-1.5 px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 flex items-center justify-between">
          <span>ℹ️ {locMsg}</span>
          <button onClick={() => setLocMsg(null)} className="text-blue-400 hover:text-blue-600 ml-2 text-xs">✕</button>
        </div>
      )}

      {/* Khung bản đồ Leaflet */}
      <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 shadow-inner" style={{ height: 560 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Điều khiển fly */}
          {flyTarget && (
            <MapController center={flyTarget.center} zoom={flyTarget.zoom} />
          )}

          {/* Vị trí của người dùng */}
          {userLatLng && (
            <>
              {/* Vòng tròn bán kính 150m */}
              <CircleMarker
                center={userLatLng}
                radius={18}
                pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1.5 }}
              />
              <Marker position={userLatLng} icon={userIcon}>
                <Popup>
                  <div style={{ minWidth: 150, fontFamily: 'sans-serif' }}>
                    <strong style={{ fontSize: 13 }}>📍 Vị trí của bạn</strong>
                    <p style={{ fontSize: 11, color: '#666', margin: '4px 0 0' }}>
                      {userLatLng[0].toFixed(5)}°N, {userLatLng[1].toFixed(5)}°E
                    </p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Ghim các cơ sở sân */}
          {facilities.map((fac) => {
            const isSelected = fac.facility_id === selectedFacilityId;
            const icon = createFacilityIcon(isSelected, fac.name);
            const dist = userLatLng
              ? distKm(userLatLng[0], userLatLng[1], fac.lat, fac.lng)
              : null;

            return (
              <Marker
                key={fac.facility_id}
                position={[fac.lat, fac.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectFacility(fac.facility_id),
                }}
                ref={(marker) => {
                  if (marker) markerRefs.current.set(fac.facility_id, marker);
                }}
                zIndexOffset={isSelected ? 1000 : 0}
              >
                <Popup minWidth={240} maxWidth={280}>
                  <div style={{ fontFamily: 'sans-serif', padding: '2px 0' }}>
                    {/* Header */}
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Cụm sân thể thao
                      </span>
                      {dist !== null && (
                        <span style={{ float: 'right', fontSize: 10, fontWeight: 700, background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', color: '#374151' }}>
                          📍 {dist} km
                        </span>
                      )}
                    </div>

                    <strong style={{ fontSize: 13, lineHeight: 1.3, display: 'block', marginBottom: 4 }}>
                      {fac.name}
                    </strong>

                    <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.4 }}>
                      {fac.address}
                    </p>

                    {/* Chip môn thể thao */}
                    <div style={{ marginBottom: 8 }}>
                      {fac.sports.map((sp) => (
                        <SportChip key={sp} name={sp} />
                      ))}
                    </div>

                    {/* Footer thông tin */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 10, color: '#9ca3af', display: 'block' }}>
                          {fac.total_courts} sân con
                        </span>
                        <strong style={{ fontSize: 12 }}>
                          {formatCurrency(fac.min_price)}/h
                        </strong>
                      </div>
                      <Link
                        to={`/facilities/${fac.facility_id}`}
                        style={{
                          display: 'inline-block',
                          padding: '5px 12px',
                          background: '#000',
                          color: '#fff',
                          borderRadius: 7,
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        Xem chi tiết →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Chú thích */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-0.5">
        <span>Nhấp vào ghim để xem thông tin • Ghim xanh là vị trí của bạn</span>
        <span className="font-semibold text-gray-600">© OpenStreetMap</span>
      </div>
    </div>
  );
}
