# Danh mục món chỉ đọc trên thiết bị; nội dung do quản trị viên cập nhật tập trung

Bản cũ cho phép mỗi thiết bị thêm, sửa, xoá (ẩn) món và lưu riêng trên máy. Ta bỏ hẳn các tính năng này: **Danh mục món** chỉ do quản trị viên cập nhật tập trung (một trang quản trị sẽ làm ở giai đoạn sau; trong lúc chờ, sửa nội dung bằng seed rồi chạy `db:seed`), còn tab "Món ăn" chỉ để tra cứu và xem công thức.

Lý do: mọi thiết bị thấy cùng một nội dung, một chỗ sửa lỗi nội dung có hiệu lực cho tất cả (vd. sửa tỏi trong món chay), và lời hứa "món chay không có tỏi" không thể bị phá bởi chỉnh sửa cục bộ. Đổi lại ta mất khả năng cá nhân hoá: gia đình không còn tự thêm món riêng hay chỉnh công thức trên máy mình.

Ứng dụng đang ở chu kỳ sử dụng đầu tiên nên không bảo toàn dữ liệu cũ: món tự thêm, bản sửa và món đã ẩn lưu trên máy **không còn được đọc** (không bị xoá khỏi bộ nhớ, nên có thể bật lại nếu cần). Lịch sử hoặc yêu thích từng dùng món tự thêm sẽ hiện "(đã xoá)".

## Thay thế
Các user story 39–45 của spec #1 (thêm, sửa, xoá, khôi phục, đặt lại, món tự thêm hoạt động như món có sẵn) và tính năng F9 không còn hiệu lực. Sự kiện phân tích `add_dish`, `edit_dish`, `delete_dish` ngừng gửi.
