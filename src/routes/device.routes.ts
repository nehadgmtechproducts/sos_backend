import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import {
  postRegisterDevice,
  postRingDevices,
  postUnregisterDevice,
  registerDeviceSchema,
  ringSchema,
  unregisterSchema,
} from '../controllers/device.controller.js';

const router = Router();
router.post('/register', validateBody(registerDeviceSchema), postRegisterDevice);
router.post('/ring', validateBody(ringSchema), postRingDevices);
router.post('/unregister', validateBody(unregisterSchema), postUnregisterDevice);
export default router;
