import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128)
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[0-9]/, "Password must include a number")
      .regex(/[^A-Za-z0-9]/, "Password must include a symbol")
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.preprocess((value) => value === "" || value === null ? undefined : value, z.string().trim().max(40).optional()),
    bio: z.preprocess((value) => value === "" || value === null ? undefined : value, z.string().trim().max(3000).optional())
  })
});
