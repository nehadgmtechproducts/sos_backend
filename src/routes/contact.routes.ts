import { Router } from 'express';
import { contactSchema, createContact, deleteContact, getContact, listContacts, updateContact, updateContactSchema } from '../controllers/contact.controller.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.get('/', listContacts);
router.post('/', validateBody(contactSchema), createContact);
router.get('/:contactId', getContact);
router.patch('/:contactId', validateBody(updateContactSchema), updateContact);
router.delete('/:contactId', deleteContact);
export default router;
