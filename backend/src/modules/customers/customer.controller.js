import * as customerService from './customer.service.js';

export async function getCustomers(req, res, next) {
  try {
    const customers = await customerService.getCustomerList(req.user, req.query);
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerHistory(req, res, next) {
  try {
    const customerId = parseInt(req.params.id);
    const data = await customerService.getCustomerHistory(req.user, customerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerReputation(req, res, next) {
  try {
    const customerId = parseInt(req.params.id);
    const updated = await customerService.updateCustomerReputation(
      req.user,
      customerId,
      req.body
    );
    res.json({
      success: true,
      message: 'Cập nhật thông tin khách hàng thành công.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

