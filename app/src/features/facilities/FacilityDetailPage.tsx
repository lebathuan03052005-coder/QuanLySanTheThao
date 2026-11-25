import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router";
import {
  getPublicFacilitiesApi,
  getPublicFacilityDetailApi,
  updateFacilityApi,
  uploadFacilityImageApi,
  uploadFacilityImagesApi,
  deleteFacilityImageApi,
  uploadCourtImageApi,
  deleteCourtImageApi,
} from "./facility.api";
import { fetchCourts, type CourtItem } from "../courts/court.api";
import { formatCurrency } from "../../shared/utils/format";
import { createWalkInBookingApi } from "../booking/booking.api";
import { useAuthStore } from "../../shared/stores/authStore";
import { SportIconMono } from "../home/PlayerHomePage";
import ImageCropModal from "../../shared/components/ImageCropModal";
import ImageViewerModal from "../../shared/components/ImageViewerModal";
import { getMediaUrl, parseImages, getFirstMediaUrl } from "../../shared/utils/media";
import {
  isPastBookingSlot,
  getLocalTodayIso,
  getInitialBookingTimes,
  BOOKING_START_TIMES,
  BOOKING_END_TIMES,
  timeToMinutes,
} from "../../shared/utils/bookingTime";

// Dữ liệu mẫu cơ sở sân mẹ phục vụ fallback khi chưa kết nối DB
const FALLBACK_FACILITIES = [
  {
    facility_id: 1,
    owner_id: 1,
    name: "Cụm Sân Bóng Đá SportLink Man Thiện",
    address: "Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM",
    phone: "0901 234 567",
    description:
      "Tổ hợp sân bóng đá cỏ nhân tạo và sân đa năng gần Học viện Công nghệ Bưu chính Viễn thông (PTIT). Mặt cỏ mới thay, hệ thống đèn LED cao cấp chống chói.",
    total_courts: 5,
    min_price: 150000,
    max_price: 250000,
    sports: ["Bóng đá", "Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền"],
    images: "/facilities/man-thien/thumb.jpg",
  },
  {
    facility_id: 2,
    owner_id: 1,
    name: "CLB Cầu Lông SportLink Arena Hiệp Phú",
    address: "Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM",
    phone: "0901 234 568",
    description:
      "Tổ hợp sân cầu lông trong nhà thảm PVC chuẩn thi đấu Yonex, có máy lạnh khu vực chờ, dịch vụ đan vợt lấy liền.",
    total_courts: 3,
    min_price: 120000,
    max_price: 180000,
    sports: ["Cầu lông", "Bóng chuyền"],
    images: "/facilities/hiep-phu/thumb.jpg",
  },
  {
    facility_id: 3,
    owner_id: 2,
    name: "Trung Tâm Pickleball & Tennis SportLink SHTP",
    address: "Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM",
    phone: "0902 000 002",
    description:
      "Tổ hợp sân Pickleball, Tennis và Bóng đá tiêu chuẩn quốc tế ngay trong lòng Khu Công Nghệ Cao. Mặt sân Acrylic chuyên nghiệp.",
    total_courts: 9,
    min_price: 180000,
    max_price: 280000,
    sports: ["Pickleball", "Tennis", "Bóng đá"],
    images: "/facilities/shtp/thumb.jpg",
  },
  {
    facility_id: 4,
    owner_id: 2,
    name: "Nhà Thi Đấu Đa Năng Đặng Văn Bi Thủ Đức",
    address: "Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM",
    phone: "0902 000 088",
    description:
      "Nhà thi đấu Bóng rổ, Cầu lông và Bóng chuyền trong nhà hiện đại với khán đài và sàn gỗ chuyên nghiệp.",
    total_courts: 9,
    min_price: 150000,
    max_price: 220000,
    sports: ["Bóng rổ", "Cầu lông", "Bóng chuyền"],
    images: "/facilities/dang-van-bi/thumb.jpg",
  },
  {
    facility_id: 5,
    owner_id: 3,
    name: "Tổ Hợp Thể Thao Làng Đại Học Thủ Đức - Khu A",
    address: "Đường Tạ Quang Bửu, KĐT ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM",
    phone: "0903 000 003",
    description:
      "Khu liên hợp thể thao đa năng đầy đủ 6 môn thể thao phục vụ sinh viên Làng Đại học Quốc gia TP.HCM.",
    total_courts: 9,
    min_price: 100000,
    max_price: 200000,
    sports: ["Bóng đá", "Cầu lông", "Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền"],
    images: "/facilities/lang-dai-hoc-a/thumb.jpg",
  },
  {
    facility_id: 6,
    owner_id: 3,
    name: "Trung Tâm Thể Thao Sinh Viên ĐHQG - Khu B",
    address: "Đường Nguyễn Du, KTX Khu B ĐHQG, P. Đông Hòa, Dĩ An / TP. Thủ Đức",
    phone: "0903 000 004",
    description:
      "Tổ hợp sân Pickleball, Tennis và Bóng rổ hiện đại ngay cạnh Ký Túc Xá Khu B ĐHQG TP.HCM.",
    total_courts: 9,
    min_price: 120000,
    max_price: 220000,
    sports: ["Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền", "Cầu lông"],
    images: "/facilities/lang-dai-hoc-b/thumb.jpg",
  },
];

// Danh sách sân con mẫu tương ứng với từng cơ sở
const SAMPLE_COURTS_BY_FACILITY: Record<number, Partial<CourtItem>[]> = {
  1: [
    { court_id: 101, court_name: "Sân 3 - Bóng Đá Cỏ Nhân Tạo 5 Người (5C)", sport_name: "Bóng đá", capacity: 10, price_per_hour: 200000, description: "Mặt cỏ kim cương mới thay, hệ thống thoát nước nhanh", utilities: "Đèn LED chống chói, Bãi giữ xe rộng, Nước uống miễn phí" },
    { court_id: 102, court_name: "Sân 4 - Pickleball Mái Che Man Thiện (P1)", sport_name: "Pickleball", capacity: 4, price_per_hour: 180000, description: "Mái che cao 8m thoáng mát, mặt sơn Acrylic 7 lớp", utilities: "Mái che, Cho thuê vợt Carbon, Quạt công nghiệp" },
    { court_id: 103, court_name: "Sân 6 - Quần Vợt Tennis Mặt Cứng (T1)", sport_name: "Tennis", capacity: 4, price_per_hour: 220000, description: "Sân Hard Court chuẩn ITF, hàng rào lưới cao 4.5m", utilities: "Ghế trọng tài, Khán đài 50 chỗ, Phòng thay đồ riêng" },
    { court_id: 104, court_name: "Sân 8 - Bóng Rổ Ngoài Trời 3x3 (BR1)", sport_name: "Bóng rổ", capacity: 8, price_per_hour: 150000, description: "Trụ rổ thủy lực chuẩn FIBA, bảng kính cường lực", utilities: "Đèn chiếu sáng ban đêm, Tủ khóa đồ cá nhân" },
    { court_id: 105, court_name: "Sân 9 - Bóng Chuyền Ngoài Trời Tiêu Chuẩn (BC1)", sport_name: "Bóng chuyền", capacity: 12, price_per_hour: 160000, description: "Sân bóng chuyền da 6x6 mặt sơn chống trơn trượt", utilities: "Lưới cáp thép, Đèn pha cao áp, Bãi xe ô tô" },
  ],
  2: [
    { court_id: 201, court_name: "Sân Cầu Lông Số 1 - Thảm Yonex Thi Đấu", sport_name: "Cầu lông", capacity: 4, price_per_hour: 160000, description: "Thảm PVC tiêu chuẩn BWF, ánh sáng chuẩn không chói mắt", utilities: "Máy lạnh khu chờ, Phòng thay đồ, Nước ion kiềm" },
    { court_id: 202, court_name: "Sân Cầu Lông Số 2 - Thảm Yonex Tập Luyện", sport_name: "Cầu lông", capacity: 4, price_per_hour: 140000, description: "Độ bám tốt, thích hợp thi đấu và giao lưu phong trào", utilities: "Ghế ngồi nghỉ, Cho thuê vợt, Quạt đảo gió" },
    { court_id: 203, court_name: "Sân Bóng Chuyền Trong Nhà Hiệp Phú", sport_name: "Bóng chuyền", capacity: 12, price_per_hour: 180000, description: "Sàn gỗ chống chấn thương, trần cao 10m", utilities: "Bảng điểm điện tử, Khán đài mini, Tủ gửi đồ" },
  ],
  3: [
    { court_id: 301, court_name: "Sân Pickleball SHTP Sân 1 (Mái Che)", sport_name: "Pickleball", capacity: 4, price_per_hour: 180000, description: "Sân mái che cao cấp mới khai trương, mặt sân chuẩn USA Pickleball", utilities: "Mái che, Đèn LED 400W, Trọng tài, Bóng thi đấu Franklin" },
    { court_id: 302, court_name: "Sân Pickleball SHTP Sân 2 (Ngoài Trời)", sport_name: "Pickleball", capacity: 4, price_per_hour: 150000, description: "Sân ngoài trời thoáng đãng, hàng rào chống gió", utilities: "Đèn đêm, Ghế nghỉ có ô che, Tủ nước giải khát" },
    { court_id: 303, court_name: "Sân Quần Vợt Tennis SHTP - Hard Court 1", sport_name: "Tennis", capacity: 4, price_per_hour: 220000, description: "Mặt sân Decoturf thi đấu US Open, độ nảy bóng chuẩn xác", utilities: "Lưới thi đấu cao cấp, Máy bắn bóng, Tắm nóng lạnh" },
    { court_id: 304, court_name: "Sân Bóng Đá 7 Người SHTP - Cỏ FIFA", sport_name: "Bóng đá", capacity: 14, price_per_hour: 280000, description: "Sân 7 người rộng rãi, hạt cao su đạt chuẩn an toàn", utilities: "Bãi đỗ ô tô miễn phí, Khán đài che mưa, Trọng tài" },
  ],
  4: [
    { court_id: 401, court_name: "Sân Bóng Rổ Trong Nhà Đặng Văn Bi (Sàn Gỗ)", sport_name: "Bóng rổ", capacity: 10, price_per_hour: 220000, description: "Sàn gỗ phong Bắc Mỹ chống trượt, bảng rổ kính cường lực 12mm", utilities: "Máy lạnh toàn khu, Khán đài 150 chỗ, Phòng thay đồ VIP" },
    { court_id: 402, court_name: "Sân Cầu Lông Đặng Văn Bi - Thảm Taraflex", sport_name: "Cầu lông", capacity: 4, price_per_hour: 170000, description: "Sân đôi tiêu chuẩn Olympic, giảm chấn tối đa cho đầu gối", utilities: "Phòng tắm nóng lạnh, Căng vợt điện tử, Wifi tốc độ cao" },
    { court_id: 403, court_name: "Sân Bóng Chuyền Sàn Gỗ Đa Năng", sport_name: "Bóng chuyền", capacity: 12, price_per_hour: 200000, description: "Vạch sơn chuẩn quốc tế, trụ lưới đệm mút bảo vệ", utilities: "Còi điện tử, Trọng tài chứng chỉ, Tủ sạc điện thoại" },
  ],
  5: [
    { court_id: 501, court_name: "Sân Bóng Đá 5 Người Cỏ Nhân Tạo KĐT A", sport_name: "Bóng đá", capacity: 10, price_per_hour: 140000, description: "Sân bóng sinh viên sôi động, đèn LED công suất lớn", utilities: "Nước đá miễn phí, Căng-tin sinh viên, Bãi giữ xe rộng" },
    { court_id: 502, court_name: "Sân Pickleball Sinh Viên Khu A (Sân P1)", sport_name: "Pickleball", capacity: 4, price_per_hour: 120000, description: "Giá ưu đãi cho HSSV, mặt sân sơn mới 100%", utilities: "Cho mượn vợt gỗ miễn phí, Đèn chiếu ban đêm" },
    { court_id: 503, court_name: "Sân Cầu Lông KTX Khu A (Sân CL1)", sport_name: "Cầu lông", capacity: 4, price_per_hour: 100000, description: "Sân cầu lông phong trào giá rẻ sinh viên", utilities: "Quạt làm mát, Nước uống đóng chai giá rẻ" },
  ],
  6: [
    { court_id: 601, court_name: "Sân Pickleball KTX Khu B - Sân Số 1", sport_name: "Pickleball", capacity: 4, price_per_hour: 140000, description: "Sân nằm ngay cạnh KTX Khu B, không gian thể thao trẻ trung", utilities: "Mái che lưới giảm nắng, Ghế nghỉ, Cho thuê bóng thi đấu" },
    { court_id: 602, court_name: "Sân Tennis Sinh Viên KTX Khu B", sport_name: "Tennis", capacity: 4, price_per_hour: 160000, description: "Sân tennis mặt cứng, vạch kẻ chuẩn ITF", utilities: "Đèn cao áp, Bãi xe máy, Dịch vụ nhặt bóng theo giờ" },
    { court_id: 603, court_name: "Sân Bóng Rổ Bê Tông Sơn Chống Trượt Khu B", sport_name: "Bóng rổ", capacity: 10, price_per_hour: 120000, description: "Sân bóng rổ 5x5 ngoài trời, vành rổ lò xo trợ lực", utilities: "Đèn pha 1000W, Vòi nước uống tự động" },
  ],
};

// Chỉ đối chiếu dữ liệu mẫu theo TÊN/ĐỊA CHỈ (id trong DB là 3, 4, 7, 8, 9, 10 nên không dùng id)
const FALLBACK_MATCHERS: { index: number; keywords: string[] }[] = [
  { index: 5, keywords: ["khu b", "nguyễn du", "đông hòa", "dĩ an"] },
  { index: 4, keywords: ["khu a", "làng đại học", "tạ quang bửu"] },
  { index: 0, keywords: ["man thiện", "ptit"] },
  { index: 1, keywords: ["hiệp phú", "lê văn việt"] },
  { index: 2, keywords: ["shtp", "công nghệ cao", "đường d2"] },
  { index: 3, keywords: ["đặng văn bi", "bình thọ"] },
];

function resolveFacilityFallback(item: { facility_id?: number; name?: string; address?: string }) {
  const text = `${item.name || ""} ${item.address || ""}`.toLowerCase();
  const matcher = FALLBACK_MATCHERS.find((m) => m.keywords.some((k) => text.includes(k)));
  return matcher ? FALLBACK_FACILITIES[matcher.index] : undefined;
}

export { getMediaUrl };

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const targetCourtId = Number(searchParams.get("courtId")) || null;

  const numericId = Number(id) || 1;
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [highlightedCourtId, setHighlightedCourtId] = useState<number | null>(targetCourtId);
  const [facility, setFacility] = useState({
    facility_id: numericId,
    owner_id: 0,
    name: "Cơ sở sân thể thao",
    address: "Đang tải địa chỉ...",
    phone: "0901 234 567",
    description: "Đang tải mô tả cơ sở...",
    total_courts: 0,
    min_price: 150000,
    max_price: 250000,
    sports: ["Bóng đá"],
    images: "/nenHomePage.png",
  });

  const [facilityImages, setFacilityImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [selectedSportFilter, setSelectedSportFilter] = useState("ALL");

  // Kiểm tra quyền: Owner của chính cơ sở này hoặc Admin hệ thống
  const isOwnerOfFacility = Boolean(
    user &&
      ((user.role as string)?.toLowerCase() === "admin" ||
        ((user.role as string)?.toLowerCase() === "owner" &&
          Number(user.id) === Number(facility.owner_id)))
  );

  // Modal xem ảnh toàn màn hình (Lightbox)
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string | null>(null);

  // Modal cắt ảnh (ImageCropModal)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<
    | { type: "facility" }
    | { type: "court"; courtId: number; courtName: string }
    | null
  >(null);
  const [isUploading, setIsUploading] = useState(false);

  // Modal chỉnh sửa thông tin cơ sở
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // File input refs
  const facilityFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const courtFileInputRef = useRef<HTMLInputElement>(null);
  const pendingCourtTargetRef = useRef<{ courtId: number; courtName: string } | null>(null);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // Modal đặt sân nhanh cho người chơi
  const [bookingCourt, setBookingCourt] = useState<CourtItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => getLocalTodayIso());
  const [bookingStartTime, setBookingStartTime] = useState(() => getInitialBookingTimes(getLocalTodayIso()).startTime);
  const [bookingEndTime, setBookingEndTime] = useState(() => getInitialBookingTimes(getLocalTodayIso()).endTime);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Mở modal đặt sân và tự động chọn khung giờ tương lai gần nhất
  function handleOpenBooking(court: CourtItem) {
    const initial = getInitialBookingTimes(getLocalTodayIso());
    setBookingCourt(court);
    setBookingDate(initial.bookingDate);
    setBookingStartTime(initial.startTime);
    setBookingEndTime(initial.endTime);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);
  }

  // Khi đổi ngày đặt sân: tự động chỉnh giờ nếu khung giờ hiện tại bị rơi vào quá khứ
  function handleBookingDateChange(newDate: string) {
    setBookingDate(newDate);
    setBookingErrorMsg(null);
    if (isPastBookingSlot(newDate, bookingStartTime)) {
      const nextTimes = getInitialBookingTimes(newDate);
      setBookingStartTime(nextTimes.startTime);
      setBookingEndTime(nextTimes.endTime);
    }
  }

  // Khi đổi giờ bắt đầu: tự động tăng giờ kết thúc nếu giờ kết thúc <= giờ bắt đầu
  function handleBookingStartTimeChange(newStart: string) {
    setBookingStartTime(newStart);
    setBookingErrorMsg(null);
    const startMin = timeToMinutes(newStart);
    const endMin = timeToMinutes(bookingEndTime);
    if (endMin <= startMin) {
      const newEndMin = Math.min(23 * 60, startMin + 90);
      const endH = Math.floor(newEndMin / 60);
      const endM = newEndMin % 60;
      setBookingEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    }
  }

  // Tải dữ liệu cơ sở và các sân con
  useEffect(() => {
    setLoading(true);

    getPublicFacilityDetailApi(numericId)
      .then((data) => {
        if (data) {
          const seedMatch = resolveFacilityFallback({
            facility_id: data.facility_id,
            name: data.name,
            address: data.address,
          });

          const rawImgs = data.images || seedMatch?.images || "/nenHomePage.png";
          const parsed = parseImages(rawImgs);
          if (parsed.length === 0) parsed.push("/nenHomePage.png");

          setFacility({
            facility_id: data.facility_id,
            owner_id: Number(data.owner_id) || 0,
            name: data.name,
            address: data.address,
            phone: data.phone || seedMatch?.phone || "0901 234 567",
            description: data.description || seedMatch?.description || "",
            total_courts: data.total_courts || seedMatch?.total_courts || 1,
            min_price: data.min_price || seedMatch?.min_price || 120000,
            max_price: data.max_price || seedMatch?.max_price || 250000,
            sports: data.sports_list ? data.sports_list.split(",").map((s) => s.trim()) : (seedMatch?.sports || ["Bóng đá"]),
            images: parsed[0],
          });
          setFacilityImages(parsed);
          setActiveImageIndex(0);
        }
      })
      .catch(() => {
        getPublicFacilitiesApi()
          .then((data) => {
            if (Array.isArray(data)) {
              const found = data.find((f) => f.facility_id === numericId);
              if (found) {
                const seedMatch = resolveFacilityFallback({
                  facility_id: found.facility_id,
                  name: found.name,
                  address: found.address,
                });
                const rawImgs = found.images || seedMatch?.images || "/nenHomePage.png";
                const parsed = parseImages(rawImgs);
                if (parsed.length === 0) parsed.push("/nenHomePage.png");

                setFacility({
                  facility_id: found.facility_id,
                  owner_id: Number(found.owner_id) || 0,
                  name: found.name,
                  address: found.address,
                  phone: found.phone || seedMatch?.phone || "0901 234 567",
                  description: found.description || seedMatch?.description || "",
                  total_courts: found.total_courts || seedMatch?.total_courts || 1,
                  min_price: found.min_price || seedMatch?.min_price || 120000,
                  max_price: found.max_price || seedMatch?.max_price || 250000,
                  sports: found.sports_list ? found.sports_list.split(",").map((s) => s.trim()) : (seedMatch?.sports || ["Bóng đá"]),
                  images: parsed[0],
                });
                setFacilityImages(parsed);
                setActiveImageIndex(0);
              }
            }
          })
          .catch(() => {
            const seedMatch = resolveFacilityFallback({ facility_id: numericId });
            if (seedMatch) {
              const parsed = [seedMatch.images];
              setFacility({
                ...seedMatch,
                total_courts: seedMatch.total_courts,
              });
              setFacilityImages(parsed);
            }
          });
      });

    // 2. Tải danh sách sân con trực thuộc cơ sở này
    fetchCourts({ facility_id: numericId })
      .then((courtsData) => {
        if (Array.isArray(courtsData) && courtsData.length > 0) {
          setCourts(courtsData);
        } else {
          const seedMatch = resolveFacilityFallback({ facility_id: numericId });
          // Không khớp cơ sở mẫu nào thì để trống, không mượn sân mẫu của cơ sở khác
          const samples = seedMatch ? SAMPLE_COURTS_BY_FACILITY[seedMatch.facility_id] || [] : [];
          setCourts(
            samples.map((c) => ({
              court_id: c.court_id!,
              facility_id: numericId,
              court_name: c.court_name!,
              sport_name: c.sport_name!,
              price_per_hour: c.price_per_hour!,
              capacity: c.capacity,
              description: c.description,
              utilities: c.utilities,
              owner_id: 1,
              sport_id: 1,
              status: "ACTIVE",
            }))
          );
        }
      })
      .catch(() => {
        const seedMatch = resolveFacilityFallback({ facility_id: numericId });
        const samples = seedMatch ? SAMPLE_COURTS_BY_FACILITY[seedMatch.facility_id] || [] : [];
        setCourts(
          samples.map((c) => ({
            court_id: c.court_id!,
            facility_id: numericId,
            court_name: c.court_name!,
            sport_name: c.sport_name!,
            price_per_hour: c.price_per_hour!,
            capacity: c.capacity,
            description: c.description,
            utilities: c.utilities,
            owner_id: 1,
            sport_id: 1,
            status: "ACTIVE",
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [numericId]);

  // Tự động định vị, cuộn mượt và kích hoạt hiệu ứng nổi bật (focus / highlight) khi vào từ trang /courts
  useEffect(() => {
    if (!targetCourtId || loading || courts.length === 0) return;

    // Tìm sân con tương ứng
    const matchedCourt = courts.find((c) => c.court_id === targetCourtId);
    if (matchedCourt && matchedCourt.sport_name) {
      // Tự động chuyển bộ lọc sang môn thể thao của sân đó để sân luôn hiển thị
      setSelectedSportFilter(matchedCourt.sport_name);
    }

    setHighlightedCourtId(targetCourtId);

    // Cuộn mượt mà đưa sân vào vị trí trung tâm tầm nhìn của người dùng
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`court-${targetCourtId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 450);

    return () => clearTimeout(scrollTimer);
  }, [targetCourtId, loading, courts]);

  // Lọc sân con theo môn thể thao
  const filteredCourts = courts.filter((court) => {
    if (selectedSportFilter === "ALL") return true;
    return court.sport_name?.toLowerCase() === selectedSportFilter.toLowerCase();
  });

  // Mở modal sửa thông tin cơ sở
  function handleOpenEditModal() {
    setEditName(facility.name);
    setEditAddress(facility.address);
    setEditPhone(facility.phone);
    setEditDescription(facility.description);
    setEditError(null);
    setIsEditModalOpen(true);
  }

  // Lưu thông tin cơ sở sau khi chỉnh sửa
  async function handleSaveFacilityInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim() || !editAddress.trim()) {
      setEditError("Tên cơ sở và địa chỉ không được để trống.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateFacilityApi(facility.facility_id, {
        name: editName.trim(),
        address: editAddress.trim(),
        phone: editPhone.trim(),
        description: editDescription.trim(),
      });

      setFacility((prev) => ({
        ...prev,
        name: updated.name || editName,
        address: updated.address || editAddress,
        phone: updated.phone || editPhone,
        description: updated.description || editDescription,
      }));
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setEditError(errorObj.response?.data?.message || "Không thể cập nhật thông tin cơ sở.");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Người dùng chọn 1 file ảnh cơ sở -> Mở modal cắt ảnh tỷ lệ 16:10
  function handleFacilityFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Nếu chọn từ 2 file trở lên -> Tự động chuyển sang tải hàng loạt
    if (files.length > 1) {
      handleBatchFacilityFiles(files);
      if (e.target) e.target.value = "";
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn một file ảnh hợp lệ (JPG, PNG, WEBP).");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropTarget({ type: "facility" });
    setIsCropModalOpen(true);

    if (e.target) e.target.value = "";
  }

  // Tải lên hàng loạt nhiều ảnh cùng lúc cho cơ sở (không cần crop từng cái)
  async function handleBatchFacilityFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;

    setIsBatchUploading(true);
    try {
      const res = await uploadFacilityImagesApi(facility.facility_id, files);
      const newImages = res.images && res.images.length > 0
        ? res.images
        : [...facilityImages, ...(res.imageUrls || [res.imageUrl])];

      setFacilityImages(newImages);
      setActiveImageIndex(newImages.length - 1);
      setFacility((prev) => ({ ...prev, images: newImages[0] }));
      alert(`Đã tải lên thành công ${files.length} ảnh vào thư viện cơ sở!`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj.response?.data?.message || "Tải nhiều ảnh thất bại, vui lòng thử lại.");
    } finally {
      setIsBatchUploading(false);
    }
  }

  // Người dùng chọn file ảnh cho sân con -> Mở modal cắt ảnh
  function handleCourtFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingCourtTargetRef.current) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn một file ảnh hợp lệ (JPG, PNG, WEBP).");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropTarget({
      type: "court",
      courtId: pendingCourtTargetRef.current.courtId,
      courtName: pendingCourtTargetRef.current.courtName,
    });
    setIsCropModalOpen(true);

    if (e.target) e.target.value = "";
  }

  // Xác nhận cắt ảnh và tải lên Backend
  async function handleConfirmCrop(croppedFile: File) {
    if (!cropTarget) return;

    setIsUploading(true);
    try {
      if (cropTarget.type === "facility") {
        // Upload ảnh cơ sở
        const res = await uploadFacilityImageApi(facility.facility_id, croppedFile);
        const newImages = res.images && res.images.length > 0 ? res.images : [...facilityImages, res.imageUrl];
        setFacilityImages(newImages);
        setActiveImageIndex(newImages.length - 1);
        setFacility((prev) => ({ ...prev, images: res.imageUrl }));
      } else if (cropTarget.type === "court") {
        // Upload ảnh sân con
        const res = await uploadCourtImageApi(cropTarget.courtId, croppedFile);
        setCourts((prev) =>
          prev.map((c) => (c.court_id === cropTarget.courtId ? { ...c, images: res.imageUrl } : c))
        );
      }

      setIsCropModalOpen(false);
      setCropImageSrc(null);
      setCropTarget(null);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj.response?.data?.message || "Tải ảnh lên thất bại, vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  }

  // Xóa ảnh cơ sở
  async function handleDeleteFacilityImage(imgUrl: string) {
    if (facilityImages.length <= 1) {
      alert("Cơ sở cần giữ ít nhất 1 ảnh đại diện.");
      return;
    }

    if (!window.confirm("Bạn có chắc chắn muốn xóa ảnh này khỏi cơ sở không?")) return;

    try {
      const res = await deleteFacilityImageApi(facility.facility_id, imgUrl);
      const remaining = res.images && res.images.length > 0 ? res.images : facilityImages.filter((img) => img !== imgUrl);
      setFacilityImages(remaining);
      setActiveImageIndex(0);
      setFacility((prev) => ({ ...prev, images: remaining[0] }));
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj.response?.data?.message || "Không thể xóa ảnh cơ sở.");
    }
  }

  // Xóa ảnh sân con
  async function handleDeleteCourtImage(courtId: number) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa ảnh tùy chỉnh của sân con này?")) return;

    try {
      await deleteCourtImageApi(courtId);
      setCourts((prev) =>
        prev.map((c) => (c.court_id === courtId ? { ...c, images: undefined } : c))
      );
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj.response?.data?.message || "Không thể xóa ảnh sân con.");
    }
  }

  // Xử lý xác nhận đặt sân
  async function handleConfirmBooking() {
    if (!bookingCourt) return;
    if (!user) {
      alert("Vui lòng đăng nhập để đặt sân!");
      return;
    }

    if (isPastBookingSlot(bookingDate, bookingStartTime)) {
      setBookingErrorMsg(
        `Khung giờ ${bookingStartTime} ngày ${bookingDate} đã ở trong quá khứ. Vui lòng chọn khung giờ trong tương lai.`
      );
      return;
    }

    if (timeToMinutes(bookingEndTime) <= timeToMinutes(bookingStartTime)) {
      setBookingErrorMsg("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
      return;
    }

    setBookingSubmitting(true);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);

    try {
      await createWalkInBookingApi({
        courtId: bookingCourt.court_id,
        bookingDate,
        startTime: bookingStartTime,
        endTime: bookingEndTime,
        customerName: user.fullName,
        customerEmail: user.email,
      });

      setBookingSuccessMsg(`Đặt sân "${bookingCourt.court_name}" thành công!`);
      setTimeout(() => {
        setBookingCourt(null);
        setBookingSuccessMsg(null);
      }, 2000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setBookingErrorMsg(
        errorObj.response?.data?.message || "Không thể đặt sân vào khung giờ này."
      );
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      {/* Ẩn các file inputs để kích hoạt từ nút bấm */}
      <input
        ref={facilityFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFacilityFileSelect}
      />
      <input
        ref={batchFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleBatchFacilityFiles(e.target.files);
          if (e.target) e.target.value = "";
        }}
      />
      <input
        ref={courtFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCourtFileSelect}
      />

      {/* Breadcrumb & Nút quay lại */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/" className="hover:text-black font-medium">Trang chủ</Link>
            <span>/</span>
            <Link to="/courts" className="hover:text-black font-medium">Khám phá sân</Link>
            <span>/</span>
            <span className="text-gray-900 font-bold truncate max-w-xs">{facility.name}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {facility.name}
            </h1>
            {isOwnerOfFacility && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-black shadow-xs">
                <span>👑</span>
                <span>BẠN LÀ CHỦ CƠ SỞ NÀY</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
            <span>📍</span>
            <span>{facility.address}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isOwnerOfFacility && (
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="text-xs font-bold text-black bg-amber-100 hover:bg-amber-200 border border-amber-300 px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>✏️</span>
              <span>Sửa thông tin cơ sở</span>
            </button>
          )}

          <Link
            to="/courts"
            className="text-xs font-bold text-gray-800 hover:bg-gray-100 bg-white px-4 py-2.5 rounded-xl border border-gray-200 transition shadow-2xs"
          >
            ← Danh sách sân
          </Link>
        </div>
      </div>

      {/* Hero Card thông tin cơ sở sân mẹ & Thư viện ảnh */}
      <div className="mt-6 bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-md grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Cột Trái: Ảnh cơ sở & Thư viện ảnh Thumbnail */}
        <div className="lg:col-span-5 bg-gray-50 p-4 sm:p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-gray-200">
          <div>
            {/* Ảnh chính đang hiển thị */}
            <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-gray-200 shadow-xs group">
              <img
                src={getMediaUrl(facilityImages[activeImageIndex] || facility.images)}
                alt={facility.name}
                onError={(e) => { e.currentTarget.src = "/nenHomePage.png"; }}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />

              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-black text-white shadow-md">
                  Cơ sở đang hoạt động
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-xs text-gray-800 shadow-xs">
                  Ảnh {activeImageIndex + 1}/{facilityImages.length}
                </span>
              </div>

              {/* Nút phóng to xem ảnh toàn cảnh */}
              <button
                type="button"
                onClick={() => {
                  setViewerImageSrc(getMediaUrl(facilityImages[activeImageIndex] || facility.images));
                  setViewerTitle(`${facility.name} - Ảnh ${activeImageIndex + 1}`);
                  setIsViewerOpen(true);
                }}
                className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/70 hover:bg-black text-white text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Phóng to ảnh"
              >
                <span>🔍</span>
                <span>Xem ảnh lớn</span>
              </button>
            </div>

            {/* Dải ảnh Thumbnail bên dưới ảnh chính */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">
                  Thư viện ảnh cơ sở ({facilityImages.length})
                </span>
                {isOwnerOfFacility && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => batchFileInputRef.current?.click()}
                      disabled={isBatchUploading}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>📁 Tải nhiều ảnh</span>
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => facilityFileInputRef.current?.click()}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>📸 Tải & Cắt</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {facilityImages.map((imgUrl, idx) => (
                  <div key={idx} className="relative shrink-0 group/thumb">
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer block ${
                        idx === activeImageIndex
                          ? "border-black shadow-md scale-105"
                          : "border-gray-200 opacity-70 hover:opacity-100 hover:border-gray-400"
                      }`}
                    >
                      <img
                        src={getMediaUrl(imgUrl)}
                        alt={`Ảnh ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>

                    {/* Nút xóa ảnh (chỉ hiển thị với Owner khi cơ sở có từ 2 ảnh trở lên) */}
                    {isOwnerOfFacility && facilityImages.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFacilityImage(imgUrl);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition shadow-md hover:bg-red-700 cursor-pointer"
                        title="Xóa ảnh này"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {/* Nút thêm ảnh dạng ô trống cho Owner */}
                {isOwnerOfFacility && (
                  <button
                    type="button"
                    onClick={() => batchFileInputRef.current?.click()}
                    disabled={isBatchUploading}
                    className="w-16 h-12 rounded-xl border-2 border-dashed border-gray-300 hover:border-black bg-white hover:bg-gray-100 transition flex flex-col items-center justify-center text-gray-500 hover:text-black shrink-0 cursor-pointer disabled:opacity-50"
                    title="Chọn nhiều ảnh từ máy tính để tải lên hàng loạt"
                  >
                    <span className="text-base font-bold leading-none">+</span>
                    <span className="text-[9px] font-bold mt-0.5">Tải nhiều</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Thanh công cụ quản lý ảnh dành riêng cho Owner */}
          {isOwnerOfFacility && (
            <div className="mt-4 pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-amber-50/70 p-3 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <span>🛡️</span>
                <span>
                  {isBatchUploading
                    ? "Đang tải ảnh lên máy chủ..."
                    : `Đã có ${facilityImages.length} ảnh trong thư viện cơ sở`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  disabled={isBatchUploading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="Chọn cùng lúc nhiều file ảnh để tải lên"
                >
                  <span>📁</span>
                  <span>{isBatchUploading ? "Đang tải..." : "Tải nhiều ảnh"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => facilityFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                  title="Tải 1 ảnh và căn chỉnh khung hình tỉ lệ 16:10"
                >
                  <span>📸</span>
                  <span>Tải & Cắt ảnh</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cột Phải: Nội dung chi tiết cơ sở */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800">
                {courts.length > 0 ? courts.length : facility.total_courts} sân con trực thuộc
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                Giá từ {formatCurrency(facility.min_price)} - {formatCurrency(facility.max_price)}/h
              </span>
              {isOwnerOfFacility && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                  ID Cơ sở: #{facility.facility_id}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-700 leading-relaxed mb-5 whitespace-pre-line">
              {facility.description || "Chưa có mô tả chi tiết cho cơ sở này."}
            </p>

            {/* Danh sách môn thể thao */}
            <div className="mb-6">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                Các môn thể thao tại cơ sở
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {facility.sports.map((sp) => (
                  <span
                    key={sp}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-black text-white"
                  >
                    <SportIconMono name={sp} className="w-3.5 h-3.5" />
                    <span>{sp}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              <span className="font-semibold text-gray-400 block">Hotline liên hệ đặt sân</span>
              <strong className="text-base text-gray-900 font-black">{facility.phone}</strong>
            </div>
            <div className="flex items-center gap-2">
              {isOwnerOfFacility && (
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold transition cursor-pointer"
                >
                  ✏️ Sửa hotline & mô tả
                </button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.address)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-black hover:bg-gray-800 text-white font-bold transition flex items-center gap-1.5"
              >
                <span>📍</span>
                <span>Chỉ đường Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Khu vực danh sách sân con trực thuộc */}
      <div className="mt-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                Danh sách sân con ({filteredCourts.length})
              </h2>
              {isOwnerOfFacility && (
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Chủ sân có thể đổi ảnh từng sân con bên dưới
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Xem chi tiết, tình trạng sẵn sàng và đặt lịch trực tiếp cho từng sân con bên dưới
            </p>
          </div>

          {/* Bộ lọc nhanh môn thể thao của sân con */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedSportFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedSportFilter === "ALL"
                  ? "bg-black text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Tất cả ({courts.length})
            </button>
            {facility.sports.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSportFilter(sport)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  selectedSportFilter.toLowerCase() === sport.toLowerCase()
                    ? "bg-black text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <SportIconMono name={sport} className="w-3 h-3" />
                <span>{sport}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 font-medium">Đang tải danh sách sân con...</div>
        ) : filteredCourts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 p-8 shadow-xs">
            <span className="text-4xl">🏟️</span>
            <p className="mt-3 text-base font-bold text-gray-800">Không có sân con nào phù hợp</p>
            <p className="text-xs text-gray-500 mt-1">Thử chọn "Tất cả" để xem toàn bộ sân của cơ sở này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourts.map((court) => {
              const isHighlighted = highlightedCourtId === court.court_id;
              const courtImg = getFirstMediaUrl(
                court.images,
                getMediaUrl(facilityImages[0] || "/nenHomePage.png")
              );
              return (
                <div
                  id={`court-${court.court_id}`}
                  key={court.court_id}
                  className={`bg-white rounded-3xl border transition-all duration-500 overflow-hidden flex flex-col justify-between group relative ${
                    isHighlighted
                      ? "ring-4 ring-amber-400 ring-offset-4 ring-offset-white border-amber-400 shadow-2xl scale-[1.02] bg-amber-50/20"
                      : "border-gray-200 hover:border-gray-400 shadow-xs hover:shadow-lg"
                  }`}
                >
                  {/* Huy hiệu nổi bật khi sân được chọn từ trang /courts */}
                  {isHighlighted && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-xl flex items-center gap-2 whitespace-nowrap animate-bounce">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                      <span>🎯 SÂN BẠN VỪA CHỌN</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHighlightedCourtId(null);
                        }}
                        className="ml-1 text-black/70 hover:text-black font-bold text-xs cursor-pointer"
                        title="Đóng nổi bật"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div>
                    {/* Ảnh sân con & Nút quản lý ảnh cho Owner */}
                    <div className="relative aspect-16/10 bg-gray-100 overflow-hidden">
                      <img
                        src={courtImg}
                        alt={court.court_name}
                        onError={(e) => { e.currentTarget.src = "/nenHomePage.png"; }}
                        className={`w-full h-full object-cover transition-transform duration-500 ${
                          isHighlighted ? "scale-105" : "group-hover:scale-103"
                        }`}
                      />

                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black text-white shadow-xs">
                          <SportIconMono name={court.sport_name || "all"} className="w-3 h-3" />
                          <span>{court.sport_name || "Thể thao"}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-white/95 px-2 py-0.5 rounded-full shadow-xs">
                          Sẵn sàng
                        </span>
                      </div>

                      {/* Phóng to ảnh sân con */}
                      <button
                        type="button"
                        onClick={() => {
                          setViewerImageSrc(courtImg);
                          setViewerTitle(court.court_name);
                          setIsViewerOpen(true);
                        }}
                        className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-black/60 hover:bg-black text-white text-[10px] font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Xem ảnh lớn"
                      >
                        <span>🔍</span>
                      </button>

                      {/* Nút Đổi ảnh / Xóa ảnh dành cho Owner của cơ sở */}
                      {isOwnerOfFacility && (
                        <div className="absolute top-3 right-3 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              pendingCourtTargetRef.current = {
                                courtId: court.court_id,
                                courtName: court.court_name,
                              };
                              courtFileInputRef.current?.click();
                            }}
                            className="px-2.5 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold transition shadow-md flex items-center gap-1 cursor-pointer"
                            title="Tải ảnh mới cho sân này"
                          >
                            <span>📷</span>
                            <span>Đổi ảnh</span>
                          </button>

                          {court.images && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCourtImage(court.court_id)}
                              className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-md flex items-center justify-center cursor-pointer"
                              title="Xóa ảnh riêng của sân này"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Nội dung thông tin sân con */}
                    <div className="p-5">
                      <h3 className="font-black text-base text-gray-900 leading-snug line-clamp-1">
                        {court.court_name}
                      </h3>

                      {court.description && (
                        <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                          {court.description}
                        </p>
                      )}

                      {court.utilities && (
                        <div className="mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
                          <span className="font-bold text-gray-700 block mb-0.5">Tiện ích:</span>
                          <span className="line-clamp-2">{court.utilities}</span>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>Sức chứa: {court.capacity || 10} người</span>
                        <span className="font-bold text-amber-500">★ 4.9</span>
                      </div>
                    </div>
                  </div>

                  {/* Giá & Nút Đặt sân */}
                  <div className="p-5 pt-0 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">Giá thuê</span>
                      <strong className="text-base font-black text-gray-900">
                        {formatCurrency(court.price_per_hour || 150000)}/h
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenBooking(court)}
                      className="px-5 py-2.5 bg-black hover:bg-gray-800 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                    >
                      Đặt sân ngay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Chỉnh sửa thông tin cơ sở (Tên, Địa chỉ, Hotline, Mô tả)          */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold text-amber-600 uppercase">Chủ cơ sở quản trị</span>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">Chỉnh sửa thông tin cơ sở</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFacilityInfo} className="mt-4 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  ⚠️ {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tên cơ sở *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="Ví dụ: Cụm Sân Thể Thao SportLink SHTP"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ cơ sở *</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  required
                  placeholder="Số nhà, tên đường, phường, quận/thành phố..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại hotline</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0901 234 567"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả cơ sở</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Giới thiệu về cơ sở, mặt cỏ/mặt thảm, tiện ích xung quanh..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-black text-white hover:bg-gray-800 transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Cắt ảnh (ImageCropModal)                                          */}
      {/* ========================================================================= */}
      {isCropModalOpen && cropImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropImageSrc}
          isProcessing={isUploading}
          initialAspect={cropTarget?.type === "facility" ? 16 / 10 : 4 / 3}
          initialShape="rect"
          onClose={() => {
            setIsCropModalOpen(false);
            setCropImageSrc(null);
            setCropTarget(null);
          }}
          onConfirmCrop={handleConfirmCrop}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Xem ảnh lớn toàn màn hình (ImageViewerModal)                     */}
      {/* ========================================================================= */}
      {isViewerOpen && viewerImageSrc && (
        <ImageViewerModal
          isOpen={isViewerOpen}
          imageUrl={viewerImageSrc}
          userName={viewerTitle || facility.name}
          userRole="Ảnh cơ sở thể thao"
          onClose={() => {
            setIsViewerOpen(false);
            setViewerImageSrc(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Đặt sân trực tuyến cho người chơi                                 */}
      {/* ========================================================================= */}
      {bookingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase">Đặt sân trực tuyến</span>
                <h3 className="text-base font-extrabold text-gray-900 mt-0.5">{bookingCourt.court_name}</h3>
              </div>
              <button
                onClick={() => setBookingCourt(null)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm">
              <div className="bg-gray-50 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Môn thể thao</p>
                  <p className="font-bold text-gray-800">{bookingCourt.sport_name || "Thể thao"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Giá thuê</p>
                  <p className="font-extrabold text-gray-900">{formatCurrency(bookingCourt.price_per_hour || 150000)}/h</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày đặt sân</label>
                <input
                  type="date"
                  value={bookingDate}
                  min={getLocalTodayIso()}
                  onChange={(e) => handleBookingDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ bắt đầu</label>
                  <select
                    value={bookingStartTime}
                    onChange={(e) => handleBookingStartTimeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
                  >
                    {BOOKING_START_TIMES.map((t) => {
                      const isPast = isPastBookingSlot(bookingDate, t);
                      return (
                        <option
                          key={t}
                          value={t}
                          disabled={isPast}
                          className={isPast ? "text-gray-300 bg-gray-50" : "text-gray-900"}
                        >
                          {t} {isPast ? "(Đã qua)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ kết thúc</label>
                  <select
                    value={bookingEndTime}
                    onChange={(e) => setBookingEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
                  >
                    {BOOKING_END_TIMES.filter((t) => timeToMinutes(t) > timeToMinutes(bookingStartTime)).map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {isPastBookingSlot(bookingDate, bookingStartTime) && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                  <span>⏰</span>
                  <span>
                    Khung giờ <strong>{bookingStartTime}</strong> ngày <strong>{bookingDate}</strong> đã ở trong quá khứ. Vui lòng chọn khung giờ trong tương lai.
                  </span>
                </div>
              )}

              {bookingErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  ⚠️ {bookingErrorMsg}
                </div>
              )}

              {bookingSuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold">
                  ✓ {bookingSuccessMsg}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBookingCourt(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={bookingSubmitting || isPastBookingSlot(bookingDate, bookingStartTime)}
                onClick={handleConfirmBooking}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black text-white hover:bg-gray-800 transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {bookingSubmitting
                  ? "Đang gửi..."
                  : isPastBookingSlot(bookingDate, bookingStartTime)
                  ? "Khung giờ đã qua"
                  : "Xác nhận đặt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
