# Hôm nay nấu gì?

Trợ lý thực đơn cho một gia đình: gợi ý ngẫu nhiên thực đơn 3 món mỗi ngày, quản lý ngân hàng món ăn, danh sách đi chợ.

## Language

**Hộ gia đình**:
Đơn vị sở hữu dữ liệu (thực đơn, ngân hàng món ăn, lịch sử, yêu thích) khi app có backend — 1 bản ghi lưu tập trung, không có khái niệm từng cá nhân đăng nhập riêng bên trong hộ.
_Avoid_: User, Account, Tài khoản, Người dùng — dự án chủ động không mô hình hoá từng cá nhân, chỉ mô hình hoá cấp hộ gia đình.

**Mã hộ gia đình**:
Chuỗi ký tự không đoán được, gắn trong 1 link (vd. `/h/xk3f9a2b`), dùng để bất kỳ thiết bị nào có link đều đọc/ghi được đúng bản ghi của hộ đó. Thay thế hoàn toàn cho đăng nhập tài khoản.
_Avoid_: Mã PIN, mã mời — đã cân nhắc và loại bỏ (xem [ADR-0001](docs/adr/0001-centralized-storage-no-session-sync.md) về phạm vi backend liên quan).

**Đồng bộ** *(thuật ngữ cần tránh dùng mơ hồ)*:
App **không** có đồng bộ real-time giữa các phiên/thiết bị. Backend chỉ là nơi lưu tập trung: mỗi phiên đọc dữ liệu hiện có khi mở app, ghi đè khi có thay đổi — không push/pull, không xử lý xung đột. Xem [ADR-0001](docs/adr/0001-centralized-storage-no-session-sync.md).

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
