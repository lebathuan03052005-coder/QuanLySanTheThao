import { getPool } from '../core/config/db.js';
import * as facilityService from '../modules/facilities/facility.service.js';
import * as sportService from '../modules/sports/sport.service.js';

async function runTests() {
  console.log('====================================================');
  console.log('KIỂM THỬ ĐẶC TẢ SPRINT 2 (WBS 3.1): CƠ SỞ, SÂN & MÔN');
  console.log('====================================================');

  const pool = await getPool();
  const ownerRes = await pool.request().query("SELECT TOP 1 user_id FROM users WHERE UPPER(role) = 'OWNER' ORDER BY user_id ASC");
  const ownerId = ownerRes.recordset[0]?.user_id ?? 0;
  const strangerOwnerId = 999999;

  let passed = 0;
  let failed = 0;
  let createdFacId = null;
  let createdCourtId = null;
  let createdSportId = null;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // TC-FAC-01: OWNER thêm cơ sở hợp lệ
    const fac = await facilityService.createFacility(ownerId, {
      name: 'Cơ sở Sân Kiểm Thử Tự Động',
      address: 'Số 999 Đường Test, TP. Thủ Đức',
      phone: '0909999999',
      description: 'Cơ sở phục vụ test tự động',
    });
    createdFacId = fac?.facility_id;
    assert(fac && fac.facility_id && fac.owner_id === ownerId, 'TC-FAC-01: OWNER thêm cơ sở hợp lệ');

    // TC-FAC-02: Thiếu tên hoặc địa chỉ bắt buộc
    let tcFac02Passed = false;
    try {
      await facilityService.createFacility(ownerId, { name: '', address: '123' });
    } catch (err) {
      tcFac02Passed = err.statusCode === 400;
    }
    assert(tcFac02Passed, 'TC-FAC-02: Backend từ chối khi thiếu tên bắt buộc (400)');

    // TC-FAC-03: OWNER xem danh sách cơ sở
    const facList = await facilityService.getOwnerFacilities(ownerId);
    assert(
      Array.isArray(facList) && facList.every((f) => f.owner_id === ownerId),
      'TC-FAC-03: Chỉ trả về danh sách cơ sở thuộc sở hữu của OWNER'
    );

    // TC-FAC-04: Sửa cơ sở của OWNER khác bị từ chối
    let tcFac04Passed = false;
    try {
      await facilityService.updateFacility(fac.facility_id, strangerOwnerId, { name: 'Hack Name' });
    } catch (err) {
      tcFac04Passed = err.statusCode === 404 || err.statusCode === 403;
    }
    assert(tcFac04Passed, 'TC-FAC-04: Từ chối khi OWNER khác cố gắng sửa cơ sở');

    // Lấy 1 sport_id đang ACTIVE
    const sports = await sportService.getAllSports({ status: 'ACTIVE' });
    const activeSportId = sports[0]?.sport_id ?? 0;

    // TC-COURT-01: Thêm sân con vào cơ sở hợp lệ
    const court = await facilityService.createCourtInFacility(fac.facility_id, ownerId, {
      courtName: 'Sân Cỏ 5 Người Số 1 (Test)',
      sportId: activeSportId,
      capacity: 10,
      description: 'Sân cỏ nhân tạo chất lượng cao',
    });
    createdCourtId = court?.court_id;
    assert(
      court && court.court_id && court.facility_id === fac.facility_id,
      'TC-COURT-01: Thêm sân con vào cơ sở hợp lệ'
    );

    // TC-COURT-02: Thêm sân vào cơ sở không tồn tại
    let tcCourt02Passed = false;
    try {
      await facilityService.createCourtInFacility(999999, ownerId, { courtName: 'Sân Ma', sportId: activeSportId });
    } catch (err) {
      tcCourt02Passed = err.statusCode === 404;
    }
    assert(tcCourt02Passed, 'TC-COURT-02: Từ chối thêm sân vào cơ sở không tồn tại (404)');

    // TC-COURT-03: Thêm sân vào cơ sở của OWNER khác
    let tcCourt03Passed = false;
    try {
      await facilityService.createCourtInFacility(fac.facility_id, strangerOwnerId, { courtName: 'Sân Lạ', sportId: activeSportId });
    } catch (err) {
      tcCourt03Passed = err.statusCode === 404 || err.statusCode === 403;
    }
    assert(tcCourt03Passed, 'TC-COURT-03: Từ chối thêm sân vào cơ sở của người khác');

    // TC-COURT-04: Ngừng hoạt động sân con
    const pausedCourt = await facilityService.updateCourtStatus(court.court_id, ownerId, 'INACTIVE');
    assert(pausedCourt.status === 'INACTIVE', 'TC-COURT-04: Đổi trạng thái ngừng hoạt động sân con');

    // TC-SPORT-01: Thêm môn thể thao hợp lệ
    const testSportName = `Môn Test ${Date.now()}`;
    const newSport = await sportService.createSport({
      sportName: testSportName,
      description: 'Môn thể thao kiểm thử tự động',
    });
    createdSportId = newSport?.sport_id;
    assert(newSport && newSport.sport_id && newSport.sport_name === testSportName, 'TC-SPORT-01: Thêm môn thể thao hợp lệ');

    // TC-SPORT-02: Thêm môn thiếu tên
    let tcSport02Passed = false;
    try {
      await sportService.createSport({ sportName: '   ' });
    } catch (err) {
      tcSport02Passed = err.statusCode === 400;
    }
    assert(tcSport02Passed, 'TC-SPORT-02: Từ chối thêm môn thiếu tên (400)');

    // TC-SPORT-03: Thêm môn trùng tên
    let tcSport03Passed = false;
    try {
      await sportService.createSport({ sportName: `  ${testSportName.toUpperCase()}  ` });
    } catch (err) {
      tcSport03Passed = err.statusCode === 409;
    }
    assert(tcSport03Passed, 'TC-SPORT-03: Từ chối thêm môn trùng tên (409 Conflict)');

    // TC-SPORT-04: Sửa mô tả môn
    const updatedSport = await sportService.updateSport(newSport.sport_id, {
      description: 'Mô tả đã được cập nhật thành công',
    });
    assert(updatedSport.description === 'Mô tả đã được cập nhật thành công', 'TC-SPORT-04: Cập nhật thông tin môn');

    // TC-SPORT-05: Ngừng hoạt động môn
    const pausedSport = await sportService.updateSportStatus(newSport.sport_id, 'INACTIVE');
    assert(pausedSport.status === 'INACTIVE', 'TC-SPORT-05: Bật/tắt trạng thái môn thể thao');

    console.log('----------------------------------------------------');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASSED / ${failed} FAILED`);
    console.log('====================================================');
  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test:', err);
  } finally {
    // Dọn dẹp toàn bộ dữ liệu tạm sinh ra trong quá trình kiểm thử
    try {
      await pool.request().query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
        BEGIN
          DELETE FROM court_prices WHERE court_id IN (
            SELECT court_id FROM courts WHERE court_name LIKE N'%Kiểm Thử%' OR court_name LIKE N'Sân Cỏ 5 Người Số 1%'
          );
        END
        DELETE FROM courts WHERE court_name LIKE N'%Kiểm Thử%' OR court_name LIKE N'Sân Cỏ 5 Người Số 1%';
        DELETE FROM facilities WHERE name LIKE N'%Kiểm Thử Tự Động%';
        DELETE FROM sports WHERE sport_name LIKE N'Môn Test %';
      `);
    } catch {
      // ignore cleanup error
    }
    process.exit(0);
  }
}

runTests();
