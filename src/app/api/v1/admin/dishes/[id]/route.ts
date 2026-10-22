import { adminHandlers } from "@/server/admin";

type Context = { params: Promise<{ id: string }> };

// No DELETE: a dish is only ever hidden, so ids held on devices always resolve.
export async function PUT(request: Request, { params }: Context) {
  return adminHandlers.updateDish(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return adminHandlers.setHidden(request, (await params).id);
}
