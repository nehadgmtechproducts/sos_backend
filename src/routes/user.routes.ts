import { Router } from 'express';
import { deleteMe, getMe, putMe, updateProfileSchema } from '../controllers/user.controller.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.get('/me', getMe);
router.put('/me', validateBody(updateProfileSchema), putMe);
router.delete('/me', deleteMe);
export default router;
