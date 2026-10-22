# Cơ sở dữ liệu là nguồn sự thật của Danh mục món; seed chỉ để khởi tạo

Hiện nay `src/seed/dishes.ts` là nguồn sự thật: `db:seed` ghi đè món theo id và ẩn mọi món không có trong seed. Khi trang quản trị cho phép **Quản trị viên** thêm, sửa, ẩn món, hai nguồn sự thật sẽ xung đột: một lần chạy `db:seed` sau đó sẽ xoá sạch chỉnh sửa và ẩn hết món do quản trị viên tạo.

Quyết định: từ khi trang quản trị ra mắt, **cơ sở dữ liệu là nguồn sự thật duy nhất**. `db:seed` chỉ khởi tạo một Danh mục món rỗng và từ chối chạy khi đã có món. File seed chỉ còn là dữ liệu khởi tạo (và dữ liệu cho test). Sao lưu bằng nút "Xuất JSON" trên trang quản trị, cộng khả năng khôi phục của Neon.

Đã cân nhắc và loại bỏ: để trang quản trị ghi ngược vào file seed (Vercel có hệ thống file chỉ đọc, và sẽ thành một lần commit cho mỗi lần sửa), hoặc giữ seed làm nguồn sự thật và chỉ cho quản trị viên "đè" lên (hai chỗ sửa cùng một thứ, dễ lệch nhau).

Hệ quả: sửa nội dung món chỉ qua trang quản trị; thay đổi có hiệu lực ngay khi lưu (không bản nháp), mỗi lần lưu tăng phiên bản danh mục trong cùng một giao dịch, và thiết bị nhận bản mới ở lần mở/làm mới kế tiếp. Món không bao giờ bị xoá hẳn, chỉ bị ẩn, để lịch sử và yêu thích trên thiết bị vẫn nhận ra tên món.
