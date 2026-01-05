import { RequestHandler } from "@builder.io/qwik-city";
import { Prisma } from "~/lib/prisma";
import { Bytes } from "~/lib/prisma/generated/internal/prismaNamespace";
import { requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.REPORTS_READ);

async function getReportData(reportId: string): Promise<Bytes> {
  const r = await Prisma.reports.findUnique({
    where: {
      id: reportId
    },
    select: {
      data: true
    }
  });
  if (!r) {
    throw new Error('Report not found');
  }

  return r.data;
}

export const onGet: RequestHandler = async ({ send, params }) => {
  const reportId = params.reportId;

  try {
    const data = await getReportData(reportId);
    const headers = new Headers();
    headers.append('Content-Type', 'application/pdf');

    send(new Response(data, {
      status: 200,
      headers: headers
    }));
  } catch (e) {
    console.error(e);
    send(new Response('Report not found', { status: 404 }));
  }
};
