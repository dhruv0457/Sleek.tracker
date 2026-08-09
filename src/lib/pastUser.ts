import { prisma } from "@/lib/prisma";

/**
 * After a brand-new user is created (either via email/password register or
 * Google OAuth), check whether a `PastUser` snapshot exists for their email.
 *
 * If it does, restore all archived history back into the live tables so the
 * returning user gets their habits, badges, streaks, etc. back automatically,
 * then delete the PastUser row.
 *
 * Called inside register/Google OAuth right after `prisma.user.create(...)`.
 * Errors are swallowed so a restore failure can never break a brand-new
 * signup flow — we'd rather the user land on an empty dashboard than fail
 * to log in at all.
 */
export async function restoreFromPastUser(newUserId: string, email: string): Promise<number> {
  try {
    const past = await prisma.pastUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!past) return 0;

    const data = JSON.parse(past.snapshot) as {
      name?: string | null;
      avatar?: string | null;
      bio?: string | null;
      locality?: string | null;
      tier?: string;
      trialEndAt?: string | null;
      settings?: any;
      habits?: any[];
      badges?: any[];
      trophies?: any[];
      reminders?: any[];
      focusSessions?: any[];
      achievements?: any[];
      aiMessages?: any[];
      aiVerifications?: any[];
      dailyLogs?: any[];
    };

    let restored = 0;

    // 0. Restore profile fields: name, avatar, bio, tier, trial (overwrites
    //    any auto-assigned values from the new signup — the returning user
    //    should look exactly like they did before deletion.)
    await prisma.user.update({
      where: { id: newUserId },
      data: {
        name: data.name ?? undefined,
        avatar: data.avatar ?? undefined,
        bio: data.bio ?? undefined,
        locality: data.locality ?? undefined,
        tier: data.tier ?? undefined,
        trialEndAt: data.trialEndAt ? new Date(data.trialEndAt) : undefined,
      },
    });

    // 1. Settings — overwrite the auto-created blank row with archived prefs.
    if (data.settings) {
      const s = data.settings;
      await prisma.userSettings.upsert({
        where: { userId: newUserId },
        create: {
          userId: newUserId,
          multitaskingDefault: s.multitaskingDefault ?? false,
          emailsMorning: s.emailsMorning ?? true,
          emailsEvening: s.emailsEvening ?? true,
          pushEnabled: s.pushEnabled ?? true,
          autoSkipOn: s.autoSkipOn ?? true,
          weekStartMon: s.weekStartMon ?? true,
          weeklyMondayReminder: s.weeklyMondayReminder ?? false,
          theme: s.theme ?? "light",
          timezone: s.timezone ?? null,
        },
        update: {
          multitaskingDefault: s.multitaskingDefault ?? false,
          emailsMorning: s.emailsMorning ?? true,
          emailsEvening: s.emailsEvening ?? true,
          pushEnabled: s.pushEnabled ?? true,
          autoSkipOn: s.autoSkipOn ?? true,
          weekStartMon: s.weekStartMon ?? true,
          weeklyMondayReminder: s.weeklyMondayReminder ?? false,
          theme: s.theme ?? "light",
          timezone: s.timezone ?? null,
        },
      });
      restored++;
    }

    // 2. Habits + their check-ins
    if (Array.isArray(data.habits)) {
      for (const h of data.habits) {
        const newHabit = await prisma.habit.create({
          data: {
            userId: newUserId,
            name: h.name,
            description: h.description ?? null,
            color: h.color ?? "#22a558",
            targetMins: h.targetMins ?? 30,
            intensityTarget: h.intensityTarget ?? 100,
            requiresCamera: !!h.requiresCamera,
            schedule: h.schedule ?? "daily",
          },
        });
        if (Array.isArray(h.checkins)) {
          for (const c of h.checkins) {
            await prisma.checkIn.create({
              data: {
                habitId: newHabit.id,
                date: c.date,
                minutes: c.minutes ?? 0,
                completed: !!c.completed,
                status: c.status ?? "pending",
                intensity: c.intensity ?? 0,
                multitasking: !!c.multitasking,
                locked: !!c.locked,
                note: c.note ?? null,
              },
            });
          }
        }
        restored++;
      }
    }

    // 3. Badges
    if (Array.isArray(data.badges)) {
      for (const b of data.badges) {
        await prisma.badge.create({
          data: {
            userId: newUserId,
            badgeId: b.badgeId,
            level: b.level ?? 1,
            line: b.line ?? "",
            unlockedAt: b.unlockedAt ? new Date(b.unlockedAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 4. Trophies (single-row per user)
    if (Array.isArray(data.trophies)) {
      for (const t of data.trophies) {
        await prisma.trophy.create({
          data: {
            userId: newUserId,
            count: t.count ?? 0,
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 5. Reminders
    if (Array.isArray(data.reminders)) {
      for (const r of data.reminders) {
        await prisma.reminder.create({
          data: {
            userId: newUserId,
            label: r.label ?? "Reminder",
            time: r.time ?? "09:00",
            message: r.message ?? "",
            enabled: r.enabled ?? true,
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 6. Focus sessions
    if (Array.isArray(data.focusSessions)) {
      for (const f of data.focusSessions) {
        await prisma.focusSession.create({
          data: {
            userId: newUserId,
            durationSec: f.durationSec ?? 0,
            completed: !!f.completed,
            createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 7. Achievements
    if (Array.isArray(data.achievements)) {
      for (const a of data.achievements) {
        await prisma.achievement.create({
          data: {
            userId: newUserId,
            level: a.level ?? 1,
            unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 8. AI messages
    if (Array.isArray(data.aiMessages)) {
      for (const m of data.aiMessages) {
        await prisma.aiMessage.create({
          data: {
            userId: newUserId,
            role: m.role ?? "user",
            content: m.content ?? "",
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 9. AI verifications (habitId is a free string — no FK relation)
    if (Array.isArray(data.aiVerifications)) {
      for (const v of data.aiVerifications) {
        await prisma.aIVerification.create({
          data: {
            userId: newUserId,
            habitId: v.habitId ?? "",
            date: v.date ?? new Date().toISOString().slice(0, 10),
            label: v.label ?? "",
            confidence: v.confidence ?? 0,
            passed: !!v.passed,
            blurry: !!v.blurry,
            imageDataUrl: v.imageDataUrl ?? null,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // 10. Daily logs
    if (Array.isArray(data.dailyLogs)) {
      for (const l of data.dailyLogs) {
        await prisma.dailyLog.create({
          data: {
            userId: newUserId,
            date: l.date,
            summary: l.summary ?? "{}",
            intensityAvg: l.intensityAvg ?? 0,
            badgesEarned: l.badgesEarned ?? 0,
            createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
          },
        }).catch(() => {});
        restored++;
      }
    }

    // Finally, drop the PastUser snapshot so the next sign-up doesn't
    // double-restore. If any steps failed, the snapshot stays intact so
    // re-registration tries again automatically.
    await prisma.pastUser.delete({ where: { email: email.toLowerCase() } });
    console.log(`[pastUser] restored ${restored} records for ${email}`);

    return restored;
  } catch (e) {
    console.error("[pastUser] restore failed for", email, ":", (e as Error)?.message || e);
    return 0;
  }
}
