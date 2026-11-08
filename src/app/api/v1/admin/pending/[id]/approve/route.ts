import { adminHandlers } from "@/server/admin";

type Context = { params: Promise<{ id: string }> };

/** Duyệt: the Món chờ duyệt becomes a dish in the Danh mục món. */
export async function POST(request: Request, { params }: Context) {
  return adminHandlers.approvePending(request, (await params).id);
}
