import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { Link } from "react-router";
import { getAllSportsApi } from "../sports/sport.api";
import { getPublicFacilitiesApi } from "../facilities/facility.api";
import { formatCurrency } from "../../shared/utils/format";
import { getMediaUrl, getFirstMediaUrl } from "../../shared/utils/media";
import SportLinkMap from "./SportLinkMap";

// Công thức Haversine tính khoảng cách đường chim bay giữa 2 tọa độ GPS (đơn vị: km)
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Component biểu tượng Thể thao đơn sắc Trắng - Đen (Monochrome Black & White)
export function SportIconMono({
  name,
  className = "w-3.5 h-3.5",
}: {
  name: string;
  className?: string;
}) {
  const n = (name || "").toLowerCase();
  if (n.includes("bóng đá") || n.includes("football")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
        <path
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m12 8 3 2.2v3.6L12 16l-3-2.2v-3.6zM12 8V3m3 2.2 4-1.5m-1 7.1 3.5 1.7M12 16v5m-3-7.8-3.5 1.7m1-7.1-4-1.5"
        />
      </svg>
    );
  }
  if (n.includes("cầu lông") || n.includes("badminton")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 19a3 3 0 100-6 3 3 0 000 6z"
        />
        <path
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 13.5L5 4h14l-4.5 9.5M12 4v9"
        />
      </svg>
    );
  }
  if (n.includes("pickleball")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <rect x="5" y="3" width="10" height="12" rx="4" strokeWidth="1.8" />
        <path strokeWidth="1.8" strokeLinecap="round" d="M10 15v6M8 21h4" />
        <circle cx="18" cy="7" r="2.5" strokeWidth="1.5" />
      </svg>
    );
  }
  if (n.includes("tennis") || n.includes("quần vợt")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="10" cy="10" r="7" strokeWidth="1.8" />
        <path
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M15 15l6 6M7 10h6M10 7v6"
        />
      </svg>
    );
  }
  if (n.includes("bóng rổ") || n.includes("basketball")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
        <path
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M3 12h18M12 3v18M5 5c3 3 3 11 0 14M19 5c-3 3-3 11 0 14"
        />
      </svg>
    );
  }
  if (n.includes("bóng chuyền") || n.includes("volleyball")) {
    return (
      <svg
        className={`${className} shrink-0`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
        <path
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M12 12c0-5 3-9 3-9M12 12c-4-3-8-2-9-1M12 12c3 4 5 8 5 9"
        />
      </svg>
    );
  }
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M12 8v8M8 12h8" />
    </svg>
  );
}

// Component Dropdown chọn Môn thể thao tùy biến giao diện cao cấp
interface SportSelectDropdownProps {
  sportsList: { id: number; name: string }[];
  selectedSportId: string;
  onSelectSport: (id: string) => void;
}

function SportSelectDropdown({
  sportsList,
  selectedSportId,
  onSelectSport,
}: SportSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const currentSport = sportsList.find((s) => String(s.id) === selectedSportId);
  const selectedLabel =
    selectedSportId === "ALL"
      ? "Tất cả môn thể thao"
      : (currentSport?.name ?? "Chọn môn");

  return (
    <div ref={dropdownRef} className="relative">
      {/* Nút bấm hiển thị môn thể thao đang chọn */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-3.5 py-2 text-left w-full hover:bg-gray-50 rounded-xl transition cursor-pointer select-none focus:outline-none"
        title="Chọn môn thể thao"
      >
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-800 shrink-0">
          <SportIconMono
            name={selectedSportId === "ALL" ? "all" : currentSport?.name || ""}
            className="w-4 h-4 text-gray-900"
          />
        </div>

        <span className="text-sm font-bold text-gray-800 truncate max-w-[155px]">
          {selectedLabel}
        </span>

        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ml-1 shrink-0 ${
            isOpen ? "rotate-180 text-gray-800" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Menu xổ xuống giao diện hiện đại */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in duration-150">
          <div className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Thể loại thể thao
          </div>

          {/* Lựa chọn Tất cả */}
          <button
            type="button"
            onClick={() => {
              onSelectSport("ALL");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
              selectedSportId === "ALL"
                ? "bg-black text-white font-bold shadow-xs"
                : "text-gray-800 hover:bg-gray-100 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedSportId === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <SportIconMono name="all" className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm">Tất cả môn thể thao</span>
            </div>
            {selectedSportId === "ALL" && (
              <span className="text-xs font-black">✓</span>
            )}
          </button>

          <div className="my-1.5 border-t border-gray-100" />

          {/* Danh sách từng môn thể thao */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {sportsList.map((sport) => {
              const isSelected = selectedSportId === String(sport.id);
              return (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => {
                    onSelectSport(String(sport.id));
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
                    isSelected
                      ? "bg-black text-white font-bold shadow-xs"
                      : "text-gray-800 hover:bg-gray-100 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <SportIconMono name={sport.name} className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm">{sport.name}</span>
                  </div>
                  {isSelected && <span className="text-xs font-black">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Kiểu dữ liệu nội bộ cho cơ sở sân mẹ (không phụ thuộc PublicFacilityItem optional fields)
interface FacilitySeed {
  facility_id: number;
  name: string;
  address: string;
  phone: string;
  description: string;
  status: string;
  total_courts: number;
  min_price: number;
  max_price: number;
  sports: string[];
  lat: number;
  lng: number;
  images: string;
}

// Danh sách Cụm Sân Mẹ (Cơ sở) Thật theo CSDL Sprint 2 kèm Tọa độ địa lý thực tế tại TP. Thủ Đức & TP.HCM
const REAL_FACILITIES_SEED: FacilitySeed[] = [
  {
    facility_id: 1,
    name: "Cụm Sân Bóng Đá SportLink Man Thiện",
    address: "Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM",
    phone: "0901 234 567",
    description:
      "Tổ hợp sân bóng đá cỏ nhân tạo và sân đa năng gần Học viện Công nghệ Bưu chính Viễn thông (PTIT).",
    status: "ACTIVE",
    total_courts: 5,
    min_price: 150000,
    max_price: 250000,
    sports: ["Bóng đá", "Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền"],
    lat: 10.8495,
    lng: 106.7905,
    images: "/facilities/man-thien/thumb.jpg",
  },
  {
    facility_id: 2,
    name: "CLB Cầu Lông SportLink Arena Hiệp Phú",
    address: "Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM",
    phone: "0901 234 568",
    description:
      "Tổ hợp sân cầu lông trong nhà thảm PVC chuẩn thi đấu Yonex, có máy lạnh khu vực chờ.",
    status: "ACTIVE",
    total_courts: 3,
    min_price: 120000,
    max_price: 180000,
    sports: ["Cầu lông", "Bóng chuyền"],
    lat: 10.849,
    lng: 106.777,
    images: "/facilities/hiep-phu/thumb.jpg",
  },
  {
    facility_id: 3,
    name: "Trung Tâm Pickleball & Tennis SportLink SHTP",
    address: "Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM",
    phone: "0902 000 002",
    description:
      "Tổ hợp sân Pickleball, Tennis và Bóng đá tiêu chuẩn quốc tế ngay trong lòng Khu Công Nghệ Cao.",
    status: "ACTIVE",
    total_courts: 9,
    min_price: 180000,
    max_price: 280000,
    sports: ["Pickleball", "Tennis", "Bóng đá"],
    lat: 10.854,
    lng: 106.798,
    images: "/facilities/shtp/thumb.jpg",
  },
  {
    facility_id: 4,
    name: "Nhà Thi Đấu Đa Năng Đặng Văn Bi Thủ Đức",
    address: "Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM",
    phone: "0902 000 088",
    description:
      "Nhà thi đấu Bóng rổ, Cầu lông và Bóng chuyền trong nhà hiện đại với khán đài và sàn gỗ chuyên nghiệp.",
    status: "ACTIVE",
    total_courts: 9,
    min_price: 150000,
    max_price: 220000,
    sports: ["Bóng rổ", "Cầu lông", "Bóng chuyền"],
    lat: 10.851,
    lng: 106.762,
    images: "/facilities/dang-van-bi/thumb.jpg",
  },
  {
    facility_id: 5,
    name: "Tổ Hợp Thể Thao Làng Đại Học Thủ Đức - Khu A",
    address: "Đường Tạ Quang Bửu, KĐT ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM",
    phone: "0903 000 003",
    description:
      "Khu liên hợp thể thao đa năng đầy đủ 6 môn thể thao phục vụ sinh viên Làng Đại học Quốc gia TP.HCM.",
    status: "ACTIVE",
    total_courts: 9,
    min_price: 100000,
    max_price: 200000,
    sports: [
      "Bóng đá",
      "Cầu lông",
      "Pickleball",
      "Tennis",
      "Bóng rổ",
      "Bóng chuyền",
    ],
    lat: 10.875,
    lng: 106.802,
    images: "/facilities/lang-dai-hoc-a/thumb.jpg",
  },
  {
    facility_id: 6,
    name: "Trung Tâm Thể Thao Sinh Viên ĐHQG - Khu B",
    address:
      "Đường Nguyễn Du, KTX Khu B ĐHQG, P. Đông Hòa, Dĩ An / TP. Thủ Đức",
    phone: "0903 000 004",
    description:
      "Tổ hợp sân Pickleball, Tennis và Bóng rổ hiện đại ngay cạnh Ký Túc Xá Khu B ĐHQG TP.HCM.",
    status: "ACTIVE",
    total_courts: 9,
    min_price: 120000,
    max_price: 220000,
    sports: ["Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền", "Cầu lông"],
    lat: 10.882,
    lng: 106.782,
    images: "/facilities/lang-dai-hoc-b/thumb.jpg",
  },
];

// Khóa nhận diện cơ sở mẫu: chỉ đối chiếu theo TÊN/ĐỊA CHỈ.
// Không khớp theo id vì id trong DB thực tế là 3, 4, 7, 8, 9, 10 — khớp theo id sẽ gán nhầm ảnh/toạ độ.
const SEED_MATCHERS: { seedId: number; keywords: string[] }[] = [
  { seedId: 6, keywords: ['khu b', 'nguyễn du', 'đông hòa', 'dĩ an'] },
  { seedId: 5, keywords: ['khu a', 'làng đại học', 'tạ quang bửu'] },
  { seedId: 1, keywords: ['man thiện', 'ptit'] },
  { seedId: 2, keywords: ['hiệp phú', 'lê văn việt'] },
  { seedId: 3, keywords: ['shtp', 'công nghệ cao', 'đường d2'] },
  { seedId: 4, keywords: ['đặng văn bi', 'bình thọ'] },
];

/**
 * Tìm dữ liệu mẫu (ảnh/toạ độ/mô tả) của một cơ sở DB.
 * Chỉ dùng để bổ sung phần còn thiếu — không bao giờ quyết định danh sách cơ sở hiển thị.
 */
export function resolveFacilitySeed(item: {
  facility_id?: number;
  name?: string;
  address?: string;
}): FacilitySeed | undefined {
  const text = `${item.name || ''} ${item.address || ''}`.toLowerCase();
  const matcher = SEED_MATCHERS.find((m) => m.keywords.some((k) => text.includes(k)));
  return matcher ? REAL_FACILITIES_SEED.find((s) => s.facility_id === matcher.seedId) : undefined;
}

// Số cơ sở mỗi trang
const ITEMS_PER_PAGE = 3;

export default function PlayerHomePage() {
  // ── State bộ lọc tìm kiếm ──────────────────────────────────────────────────
  const [keyword, setKeyword] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // ── State dữ liệu ──────────────────────────────────────────────────────────
  const [sportsList, setSportsList] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [facilities, setFacilities] =
    useState<FacilitySeed[]>(REAL_FACILITIES_SEED);

  // ── State cơ sở đang chọn & phân trang ────────────────────────────────────
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(
    REAL_FACILITIES_SEED[0]?.facility_id ?? null,
  );
  const [currentPage, setCurrentPage] = useState<number>(1);

  // ── Nạp danh mục thể thao từ Backend ──────────────────────────────────────
  useEffect(() => {
    getAllSportsApi()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSportsList(
            data.map((s) => ({ id: s.sport_id, name: s.sport_name })),
          );
        } else {
          setSportsList([
            { id: 1, name: "Bóng đá" },
            { id: 2, name: "Cầu lông" },
            { id: 3, name: "Pickleball" },
            { id: 4, name: "Tennis" },
            { id: 5, name: "Bóng rổ" },
            { id: 6, name: "Bóng chuyền" },
          ]);
        }
      })
      .catch(() => {
        setSportsList([
          { id: 1, name: "Bóng đá" },
          { id: 2, name: "Cầu lông" },
          { id: 3, name: "Pickleball" },
          { id: 4, name: "Tennis" },
          { id: 5, name: "Bóng rổ" },
          { id: 6, name: "Bóng chuyền" },
        ]);
      });
  }, []);

  // ── Nạp danh sách cụm sân mẹ từ API, merge hai chiều với seed data ─────────
  useEffect(() => {
    getPublicFacilitiesApi()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // 1. Duyệt qua TẤT CẢ cơ sở từ DB để hiển thị đầy đủ (kể cả cơ sở ID 7+)
          const mergedFromApi: FacilitySeed[] = data.map((apiItem, idx) => {
            // Đối chiếu thông minh theo ID hoặc Tên/Địa chỉ
            const seedMatch = resolveFacilitySeed(apiItem);

            const sportsArr = apiItem.sports_list
              ? apiItem.sports_list.split(",").map((s: string) => s.trim())
              : seedMatch?.sports || ["Thể thao đa năng"];

            // Ưu tiên: lat/lng từ API nếu có; nếu không thì lấy từ seedMatch; nếu cơ sở mới thì phân bố quanh Thủ Đức
            const lat =
              apiItem.lat && !isNaN(Number(apiItem.lat))
                ? Number(apiItem.lat)
                : seedMatch?.lat || 10.845 + (idx % 6) * 0.008;
            const lng =
              apiItem.lng && !isNaN(Number(apiItem.lng))
                ? Number(apiItem.lng)
                : seedMatch?.lng || 106.775 + (idx % 6) * 0.009;

            // Ưu tiên: images từ API nếu có; nếu không thì lấy theo seedMatch tương ứng tên cơ sở
            const images = getFirstMediaUrl(
              apiItem.images,
              seedMatch?.images || "/nenHomePage.png"
            );

            return {
              facility_id: apiItem.facility_id,
              name:
                apiItem.name ||
                seedMatch?.name ||
                `Cơ sở #${apiItem.facility_id}`,
              address:
                apiItem.address || seedMatch?.address || "TP. Thủ Đức, TP.HCM",
              phone: apiItem.phone || seedMatch?.phone || "0901 234 567",
              description: apiItem.description || seedMatch?.description || "",
              status: apiItem.status || "ACTIVE",
              total_courts:
                Number(apiItem.total_courts) || seedMatch?.total_courts || 1,
              min_price:
                apiItem.min_price != null
                  ? Number(apiItem.min_price)
                  : seedMatch?.min_price || 120000,
              max_price:
                apiItem.max_price != null
                  ? Number(apiItem.max_price)
                  : seedMatch?.max_price || 250000,
              sports: sportsArr,
              lat,
              lng,
              images,
            };
          });

          // 2. API là nguồn dữ liệu chính: chỉ hiển thị các cơ sở đang có thật trong DB
          //    (kể cả cơ sở mới thêm với id 11+); seed chỉ bổ sung ảnh/toạ độ còn thiếu.
          setFacilities(mergedFromApi);
          if (mergedFromApi.length > 0) {
            setSelectedFacilityId(mergedFromApi[0].facility_id);
          }
        }
      })
      .catch(() => {
        // Fallback: giữ nguyên REAL_FACILITIES_SEED khi API lỗi
      });
  }, []);

  // ── Reset phân trang khi thay đổi bộ lọc ──────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedSportId]);

  // ── Lọc cơ sở theo từ khóa và môn thể thao ────────────────────────────────
  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      const kw = keyword.trim().toLowerCase();
      const matchKeyword =
        !kw ||
        fac.name.toLowerCase().includes(kw) ||
        fac.address.toLowerCase().includes(kw) ||
        fac.sports.some((s) => s.toLowerCase().includes(kw));

      const selectedSportName =
        selectedSportId !== "ALL"
          ? sportsList
              .find((s) => String(s.id) === selectedSportId)
              ?.name?.toLowerCase()
          : null;

      const matchSport =
        !selectedSportName ||
        fac.sports.some((s) => s.toLowerCase().includes(selectedSportName));

      return matchKeyword && matchSport;
    });
  }, [facilities, keyword, selectedSportId, sportsList]);

  // ── Phân trang ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredFacilities.length / ITEMS_PER_PAGE) || 1;
  const paginatedFacilities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFacilities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFacilities, currentPage]);

  // ── Xử lý tìm kiếm ────────────────────────────────────────────────────────
  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (filteredFacilities.length > 0) {
      setSelectedFacilityId(filteredFacilities[0].facility_id);
    }
  }

  // ── Chọn cơ sở từ cột trái → map sẽ fly đến vị trí đó ────────────────────
  function handleSelectFacility(fac: FacilitySeed) {
    setSelectedFacilityId(fac.facility_id);
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* =====================================================================
          1. HERO BANNER: NỀN ẢNH nenHomePage.png BAO PHỦ TOÀN BỘ
          ===================================================================== */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 w-full">
        <div className="relative w-full overflow-hidden rounded-3xl min-h-[380px] sm:min-h-[430px] shadow-2xl border border-blue-900/40 flex flex-col justify-center">
          {/* Ảnh nền nenHomePage.png bao phủ toàn diện */}
          <img
            src="/nenHomePage.png"
            alt="SportLink Hero Sports Background"
            className="absolute inset-0 w-full h-full object-cover object-right sm:object-center select-none"
          />

          {/* Lớp phủ gradient làm nổi bật chữ trắng bên trái */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#071a3d]/85 via-[#092657]/70 to-transparent sm:to-black/10 pointer-events-none" />

          {/* Nội dung thông điệp chính */}
          <div className="relative z-10 max-w-2xl p-7 sm:p-12 lg:p-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md text-amber-300 border border-white/20 mb-4 shadow-xs">
              <span>Ứng dụng quản lý sân thể thao</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
              Khám phá <span className="text-[#38bdf8]">sân thể thao</span>.
              <br />
              Định vị trực quan quanh bạn.
            </h1>

            <p className="mt-3.5 text-sm sm:text-base lg:text-lg text-blue-100 font-normal leading-relaxed max-w-xl drop-shadow-xs">
              Dễ dàng tìm kiếm cụm sân, tra cứu các môn thể thao có trong từng
              cơ sở và định vị trực quan trên bản đồ thực tế.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/courts"
                className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-sm"
              >
                Khám phá sân bóng
              </Link>
              <Link
                to="/matches"
                className="px-5 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 border border-white/30 text-white font-semibold transition backdrop-blur-md text-sm"
              >
                Cáp kèo ngay
              </Link>
            </div>
          </div>
        </div>

        {/* ===================================================================
            2. THANH TÌM KIẾM NỔI (SEARCH BAR NGAY DƯỚI HERO BANNER)
            =================================================================== */}
        <div className="relative z-20 max-w-5xl mx-auto -mt-7 sm:-mt-8 px-2">
          <form
            onSubmit={handleSearchSubmit}
            className="bg-white rounded-2xl md:rounded-full shadow-2xl border border-gray-100 p-2 sm:p-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-0 transition-all hover:shadow-blue-500/15"
          >
            {/* Ô 1: Nhập Tên sân hoặc Địa chỉ */}
            <div className="flex-1 flex items-center gap-3 px-4 py-2 sm:py-2.5">
              <svg
                className="w-5 h-5 text-gray-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm tên cụm sân, đường, khu vực..."
                className="w-full text-sm font-medium text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="text-gray-400 hover:text-gray-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200" />

            {/* Ô 2: Chọn Thể loại Môn thể thao (Custom Dropdown cao cấp) */}
            <div className="px-1 py-1">
              <SportSelectDropdown
                sportsList={sportsList}
                selectedSportId={selectedSportId}
                onSelectSport={(id) => setSelectedSportId(id)}
              />
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200" />

            {/* Ô 3: Chọn ngày */}
            <div className="flex items-center gap-2.5 px-4 py-2 sm:py-2.5 relative">
              <svg
                className="w-5 h-5 text-gray-700 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  strokeWidth="1.8"
                />
                <path
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  d="M16 2v4M8 2v4M3 10h18"
                />
              </svg>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer pr-2"
              />
            </div>

            {/* Nút Tìm kiếm */}
            <button
              type="submit"
              className="bg-black hover:bg-gray-800 text-white font-bold text-sm px-7 py-3 rounded-xl md:rounded-full flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Tìm kiếm</span>
            </button>
          </form>
        </div>
      </section>

      {/* =======================================================================
          3. BỐ CỤC 2 CỘT CHÍNH:
          CỘT TRÁI (5 cols): DANH SÁCH 3 CƠ SỞ / TRANG
          CỘT PHẢI (7 cols): BẢN ĐỒ LEAFLET THẬT
          ======================================================================= */}
      <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── CỘT TRÁI (5 cols): DANH SÁCH CƠ SỞ ─────────────────────────── */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
                <h2 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                  Cơ sở Sân Thể Thao ({filteredFacilities.length} cơ sở)
                </h2>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                3 cơ sở / trang
              </span>
            </div>

            {filteredFacilities.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
                <p className="font-bold text-gray-800">
                  Không tìm thấy cụm sân phù hợp
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Vui lòng thử tìm từ khóa khác hoặc xóa bộ lọc.
                </p>
                <button
                  onClick={() => {
                    setKeyword("");
                    setSelectedSportId("ALL");
                  }}
                  className="mt-3 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl"
                >
                  Xem toàn bộ cơ sở
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedFacilities.map((fac) => {
                  const isSelected = selectedFacilityId === fac.facility_id;

                  return (
                    <div
                      key={fac.facility_id}
                      onClick={() => handleSelectFacility(fac)}
                      className={`bg-white rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "border-black ring-2 ring-black/10 shadow-lg bg-gray-50/50"
                          : "border-gray-200 hover:border-gray-400 hover:shadow-md"
                      }`}
                    >
                      <div className="flex gap-3 sm:gap-3.5 items-start">
                        {/* Ảnh thu nhỏ cơ sở */}
                        <img
                          src={getMediaUrl(fac.images)}
                          alt={fac.name}
                          onError={(e) => {
                            e.currentTarget.src = "/nenHomePage.png";
                          }}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0 border border-gray-100"
                        />

                        {/* Thông tin Cụm sân mẹ */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 leading-snug line-clamp-2">
                              {fac.name}
                            </h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 shrink-0">
                              {fac.total_courts} sân
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                            {fac.address}
                          </p>

                          {/* Chip môn thể thao (icon đen trắng + tên) */}
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {fac.sports.slice(0, 4).map((sp) => (
                              <span
                                key={sp}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-900 text-white shadow-2xs"
                              >
                                <SportIconMono
                                  name={sp}
                                  className="w-2.5 h-2.5 text-white"
                                />
                                <span>{sp}</span>
                              </span>
                            ))}
                            {fac.sports.length > 4 && (
                              <span className="text-[10px] font-bold text-gray-500 px-1">
                                +{fac.sports.length - 4}
                              </span>
                            )}
                          </div>

                          {/* Giá thuê và nút thao tác */}
                          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-gray-400 block leading-tight">
                                Giá tham khảo
                              </span>
                              <span className="text-[11px] sm:text-xs font-black text-gray-900">
                                {formatCurrency(fac.min_price || 120000)} -{" "}
                                {formatCurrency(fac.max_price || 250000)}/h
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectFacility(fac);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-gray-300 text-[11px] font-bold text-gray-700 hover:bg-gray-100 transition"
                              >
                                📍 Định vị
                              </button>
                              <Link
                                to={`/facilities/${fac.facility_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-bold transition shadow-xs"
                              >
                                Chi tiết →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Phân trang */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-2">
                    <span className="text-xs text-gray-500 font-medium">
                      Trang {currentPage} / {totalPages} (
                      {filteredFacilities.length} cơ sở)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        ← Trước
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                              currentPage === page
                                ? "bg-black text-white shadow-xs"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                            }`}
                          >
                            {page}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Sau →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── CỘT PHẢI (7 cols): BẢN ĐỒ LEAFLET THẬT ─────────────────────── */}
          <div className="lg:col-span-7 sticky top-20">
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md p-4">
              <SportLinkMap
                facilities={filteredFacilities}
                selectedFacilityId={selectedFacilityId}
                onSelectFacility={(id) => {
                  setSelectedFacilityId(id);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================================
          4. THANH THÔNG ĐIỆP CỘNG ĐỒNG
          ======================================================================= */}
      <div className="w-full bg-blue-50/80 border-t border-blue-100/80 py-3 mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">SportLink</span>
            <span>–</span>
            <span className="text-gray-700 font-medium">
              Kết nối đam mê thể thao, xây dựng cộng đồng vững mạnh!
            </span>
          </div>

          <div className="flex items-center gap-4 text-gray-500">
            <span>Cụm sân chuẩn thi đấu</span>
            <span>•</span>
            <Link
              to="/courts"
              className="text-blue-600 hover:underline font-semibold"
            >
              Xem tất cả sân →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
