import { DishFormScreen } from "@/components/admin/dish-form-screen";

export default async function EditDishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DishFormScreen id={id} />;
}
