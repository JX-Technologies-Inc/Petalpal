import { requireAiIdentity } from "./ai-identity.js";

export class PrivateEventRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getEventById({ identity, eventId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.event.findFirst({ where: { id: eventId, ownerId } });
  }

  async deleteEventAndAffectedReports({ identity, eventId }) {
    const ownerId = requireAiIdentity(identity);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId, ownerId }, select: { id: true } });
      if (!event) return null;

      const evidence = await tx.aiEvidence.findMany({
        where: { ownerId, sourceEventId: eventId },
        select: { weeklyReportId: true, monthlyReportId: true, yearlyReportId: true }
      });
      const weeklyReportIds = [...new Set(evidence.map((item) => item.weeklyReportId).filter(Boolean))];
      const monthlyReportIds = [...new Set(evidence.map((item) => item.monthlyReportId).filter(Boolean))];
      const yearlyReportIds = [...new Set(evidence.map((item) => item.yearlyReportId).filter(Boolean))];

      if (weeklyReportIds.length) {
        await tx.weeklyReport.deleteMany({ where: { ownerId, id: { in: weeklyReportIds } } });
      }
      if (monthlyReportIds.length) {
        await tx.monthlyReport.deleteMany({ where: { ownerId, id: { in: monthlyReportIds } } });
      }
      if (yearlyReportIds.length) {
        await tx.yearlyReport.deleteMany({ where: { ownerId, id: { in: yearlyReportIds } } });
      }
      await tx.event.deleteMany({ where: { id: eventId, ownerId } });
      return {
        id: eventId,
        deletedReports: {
          weekly: weeklyReportIds.length,
          monthly: monthlyReportIds.length,
          yearly: yearlyReportIds.length
        }
      };
    });
  }
}
