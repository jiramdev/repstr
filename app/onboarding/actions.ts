"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { refreshUserCache } from "@/lib/queries";
import { z } from "zod";

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function saveOnboarding(input: {
  age: string;
  heightCm: string;
  sex: string;
  weight: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const parsed = z
    .object({
      age: z.string().max(16),
      heightCm: z.string().max(16),
      sex: z.string().max(16),
      weight: z.string().max(16),
    })
    .safeParse({
      age: input?.age ?? "",
      heightCm: input?.heightCm ?? "",
      sex: input?.sex ?? "",
      weight: input?.weight ?? "",
    });
  if (!parsed.success) return { error: "Controleer de velden." };
  const { age: ageRaw, heightCm: heightRaw, sex: sexRaw, weight: weightRaw } = parsed.data;

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      age: age === null ? null : Math.round(age),
      heightCm,
      sex,
    },
  });

  if (weight !== null) {
    await prisma.bodyWeightLog.create({
      data: { userId: session.user.id, weight },
    });
  }

  refreshUserCache(session.user.id);
  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/analytics");
  return { success: true };
}
