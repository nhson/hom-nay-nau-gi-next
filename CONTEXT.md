# Hôm nay nấu gì?

Trợ lý thực đơn cho một gia đình: gợi ý ngẫu nhiên thực đơn 3 món mỗi ngày, quản lý ngân hàng món ăn, danh sách đi chợ.

## Language

**Nhóm món** *(course/category)*:
Phân loại món trong phạm vi **Bữa cơm 3 món**: `xao` (Xào/Luộc/Salad), `canh`, `man` (Món mặn). Mỗi bữa cơm 3 món luôn lấy đúng 1 món/nhóm. Không có nhóm thứ 4 — "chay" và "vùng miền" không phải Nhóm món, xem hai mục dưới.
_Avoid_: Danh mục, Category (khi nói tiếng Anh xen kẽ) — dùng thống nhất "Nhóm món" để phân biệt với Kiểu bữa ăn.

**Kiểu bữa ăn** *(meal type)*:
Cấu trúc tổng thể của 1 bữa, quyết định số món và cách chọn:
- **Bữa cơm 3 món**: mặc định hiện tại — 1 món/Nhóm món (xào + canh + mặn).
- **Bữa 1 món**: món nước ăn độc lập (phở, bún, nui...) — thay thế hoàn toàn Bữa cơm 3 món hôm đó, chỉ 1 món duy nhất, không có canh/xào/mặn đi kèm.
_Avoid_: nhét món nước vào Nhóm món "Canh" — đã cân nhắc và loại bỏ, xem [ADR-0002](docs/adr/0002-meal-type-vs-category.md).

**Chay**:
Thuộc tính (tag) gắn trên món ăn, không phải Nhóm món hay Kiểu bữa ăn riêng. Dùng làm bộ lọc: khi bật "ăn chay", cả 3 Nhóm món trong Bữa cơm 3 món đều chỉ random trong các món có tag `chay`. Món có tag `chay:true` **không** dùng tỏi trong `ingredients`/`steps` — dùng hành boa-rô (leek) thay thế khi món cần vị tương tự.

**Vùng miền**:
Thuộc tính (tag) gắn trên món ăn — Bắc / Trung / Nam. Hiện tại **chỉ hiển thị thông tin**, không dùng để lọc/random (có thể nâng cấp thành bộ lọc sau).

**Danh mục món**:
Danh sách các món ăn dùng chung cho mọi thiết bị, do quản trị viên cập nhật tập trung. Thiết bị chỉ đọc: người dùng tra cứu, tìm, lọc và xem công thức ở tab "Món ăn", nhưng không thêm, sửa hay xoá món. Nội dung nằm trong cơ sở dữ liệu và chỉ quản trị viên sửa (xem [ADR-0004](docs/adr/0004-database-is-the-catalog-source-of-truth.md)). Xem thêm [ADR-0003](docs/adr/0003-dish-catalog-is-read-only.md).
_Avoid_: Món tự thêm, món đã sửa, ẩn/khôi phục món — các khái niệm này không còn tồn tại ở phía người dùng.

**Món đã ẩn**:
Món mà quản trị viên đã ẩn khỏi **Danh mục món**: không còn được gợi ý và không hiện ở tab "Món ăn", nhưng vẫn được nhận ra ở nơi thiết bị đã lưu nó (thực đơn hôm nay, lịch sử, yêu thích). Không bao giờ bị xoá hẳn. "(đã xoá)" chỉ hiện cho mã món mà máy chủ không còn biết.
_Avoid_: Món đã xoá, món ngừng dùng.

**Quản trị viên**:
Người duy nhất được đăng nhập vào app: chủ của app, có toàn quyền cập nhật **Danh mục món** (thêm, sửa, ẩn, hiện lại món) qua trang quản trị. Không có vai trò hay phân quyền, không có tài khoản cho người dùng thường: mọi người còn lại chỉ là người dùng ẩn danh, đọc Danh mục món và giữ dữ liệu cá nhân trên chính thiết bị của mình.
_Avoid_: User, Account, Tài khoản, Người dùng, Admin (trong chữ hiển thị cho người dùng) — app không có khái niệm tài khoản người dùng.
