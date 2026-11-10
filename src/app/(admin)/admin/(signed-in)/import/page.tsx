import { redirect } from "next/navigation";

// Nhập từ file is a tab of Thêm món since feat-021; old links and bookmarks land there.
export default function ImportPage() {
  redirect("/admin/add?cach=file");
}
