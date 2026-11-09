import * as customerService from './customer.service.js';

export async function getCustomerList(req, res, next) {
  try {
    const list = await customerService.getCustomerList(req.user, req.query);
    res.json({
      success: true,
      data: list,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerHistory(req, res, next) {
  try {
    const customerId = parseInt(req.params.id);
    const data = await customerService.getCustomerHistory(req.user, customerId);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerReputation(req, res, next) {
  try {
    const customerId = parseInt(req.params.id);
    const updated = await customerService.updateCustomerReputation(customerId, req.body);
    res.json({
      success: true,
      message: 'Đã cập nhật thông tin khách hàng.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

