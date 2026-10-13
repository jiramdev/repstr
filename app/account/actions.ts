"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshUserCache } from "@/lib/queries";
import { revalidateTabs } from "@/lib/revalidate-tabs";
import bcrypt from "bcryptjs";
import { passwordRuleError } from "@/lib/password";
import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";

export interface AccountInput {
  name: string;
  email: string;
  age: string;
  heightCm: string;
  sex: string;
  weight: string;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function updateAccount(input: AccountInput, currentPassword = "") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const parsed = z
    .object({ name: nameSchema, email: emailSchema })
    .safeParse({ name: input?.name?.trim(), email: input?.email?.trim() });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.path[0];
    return { error: issue === "email" ? "Vul een geldig e-mailadres in." : "Vul een gebruikersnaam in." };
  }
  const name = parsed.data.name;
  const email = parsed.data.email;

  const strings = z
    .object({
      age: z.string().max(16),
      heightCm: z.string().max(16),
      sex: z.string().max(16),
      weight: z.string().max(16),
      currentPassword: z.string().max(128),
    })
    .safeParse({
      age: input?.age ?? "",
      heightCm: input?.heightCm ?? "",
      sex: input?.sex ?? "",
      weight: input?.weight ?? "",
      currentPassword,
    });
  if (!strings.success) return { error: "Controleer de velden." };
  const { age: ageRaw, heightCm: heightRaw, sex: sexRaw, weight: weightRaw } = strings.data;
  const currentPasswordSafe = strings.data.currentPassword;

  const age = parseOptionalNumber(ageRaw);
  if (ageRaw.trim() && (age === null || age < 10 || age > 100)) {
    return { error: "Leeftijd moet tussen 10 en 100 liggen." };
  }

  const heightCm = parseOptionalNumber(heightRaw);
  if (heightRaw.trim() && (heightCm === null || heightCm < 80 || heightCm > 250)) {
    return { error: "Lengte moet tussen 80 en 250 cm liggen." };
  }

  const weight = parseOptionalNumber(weightRaw);
  if (weightRaw.trim() && (weight === null || weight <= 0 || weight > 400)) {
    return { error: "Voer een geldig gewicht in." };
  }

  const sex = sexRaw === "man" || sexRaw === "vrouw" || sexRaw === "anders" ? sexRaw : null;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!currentUser) return { error: "Account niet gevonden." };

  const emailChanged = email !== currentUser.email;
  if (emailChanged) {
    if (!currentPasswordSafe) {
      return { error: "Vul je huidige wachtwoord in om je e-mail te wijzigen." };
    }
    const matches = await bcrypt.compare(currentPasswordSafe, currentUser.passwordHash);
    if (!matches) return { error: "Huidig wachtwoord klopt niet." };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing && existing.id !== session.user.id) {
    return { error: "Dit e-mailadres is al in gebruik." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email,
        age: age === null ? null : Math.round(age),
        heightCm,
        sex,
        ...(emailChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Dit e-mailadres is al in gebruik." };
    }
    throw error;
  }

  if (weight !== null) {
    const latest = await prisma.bodyWeightLog.findFirst({
      where: { userId: session.user.id },
      orderBy: { loggedAt: "desc" },
      select: { weight: true },
    });
    if (!latest || latest.weight !== weight) {
      await prisma.bodyWeightLog.create({
        data: { userId: session.user.id, weight },
      });
    }
  }

  refreshUserCache(session.user.id);
  revalidateTabs();
  return { success: true, emailChanged };
}

export async function updatePassword(currentPassword: string, nextPassword: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const parsed = z
    .object({ current: z.string().min(1).max(128), next: passwordSchema })
    .safeParse({ current: currentPassword, next: nextPassword });
  if (!parsed.success) {
    return { error: "Vul je huidige en nieuwe wachtwoord in." };
  }
  const tooShort = passwordRuleError(parsed.data.next, "Het nieuwe wachtwoord");
  if (tooShort) return { error: tooShort };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Account niet gevonden." };

  const matches = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!matches) return { error: "Huidig wachtwoord klopt niet." };

  const passwordHash = await bcrypt.hash(parsed.data.next, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });

  return { success: true };
}
