import { adminHandlers } from "@/server/admin";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return adminHandlers.getPending(request, (await params).id);
}

/** Lưu: save edits without publishing. */
export async function PUT(request: Request, { params }: Context) {
  return adminHandlers.updatePending(request, (await params).id);
}

/** Bỏ. */
export async function DELETE(request: Request, { params }: Context) {
  return adminHandlers.discardPending(request, (await params).id);
}
