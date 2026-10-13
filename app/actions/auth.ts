"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { passwordRuleError } from "@/lib/password";
import { TOO_MANY_ATTEMPTS_NL, clientIp, limitSignUp } from "@/lib/rate-limit";
import { z } from "zod";
import { emailSchema } from "@/lib/validation";

export async function registerUser(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().max(80).nullish(),
      email: emailSchema,
      password: z.string().max(128),
    })
    .safeParse({
      name: typeof formData.get("name") === "string" ? (formData.get("name") as string) : null,
      email: typeof formData.get("email") === "string" ? (formData.get("email") as string) : "",
      password: typeof formData.get("password") === "string" ? (formData.get("password") as string) : "",
    });

  if (!parsed.success || !parsed.data.password) {
    return { error: "E-mailadres en wachtwoord zijn verplicht." };
  }
  const { name, email, password } = parsed.data;

  const tooShort = passwordRuleError(password);
  if (tooShort) return { error: tooShort };

  const ip = clientIp(await headers());
  if ((await limitSignUp(ip)).limited) {
    return { error: TOO_MANY_ATTEMPTS_NL };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return { error: "Dit e-mailadres is al in gebruik." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        schedule: {
          create: {
            days: {
              create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
                dayOfWeek: day,
              })),
            },
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Dit e-mailadres is al in gebruik." };
    }
    throw error;
  }

  return { success: true };
}
