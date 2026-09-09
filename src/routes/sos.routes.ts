import { Router } from 'express';
import { activateSos, activateSosSchema, listSosHistory, resolveSos } from '../controllers/sos.controller.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.get('/history', listSosHistory);
router.post('/activate', validateBody(activateSosSchema), activateSos);
router.post('/:activationId/resolve', resolveSos);
export default router;
