import { Router } from "express";
import {
  createUser,
  deleteUser,
  importStudents,
  listUsers,
  permanentlyDeleteMentor,
  updateUser
} from "../controllers/userController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { csvUpload, decompressCompressedUpload, finalizeCsvUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/commonSchemas.js";
import { createUserSchema, listUsersSchema, updateUserSchema } from "../validators/userSchemas.js";

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole("admin", "superAdmin"));
userRoutes.get("/", validate(listUsersSchema), listUsers);
userRoutes.post("/", validate(createUserSchema), createUser);
userRoutes.post("/import/students", csvUpload.single("file"), decompressCompressedUpload, finalizeCsvUpload, importStudents);
userRoutes.delete("/mentors/:id/permanent", validate(idParamsSchema), requireRole("superAdmin"), permanentlyDeleteMentor);
userRoutes.delete("/:id/permanent", validate(idParamsSchema), requireRole("superAdmin"), permanentlyDeleteMentor);
userRoutes.patch("/:id", validate(updateUserSchema), updateUser);
userRoutes.delete("/:id", validate(idParamsSchema), deleteUser);
