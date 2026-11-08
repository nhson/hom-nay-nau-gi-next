# Món do AI đề xuất phải qua Món chờ duyệt trước khi vào Danh mục món

Phase 2 thêm hai cách AI tạo món: **Quản trị viên** tải 1–4 ảnh một công thức (sách, giấy viết tay, ảnh chụp màn hình) lên `/admin`, và **Tác nhân thu thập** chạy mỗi ngày đọc các **Nguồn công thức**. AI có thể đọc sai, phân loại sai Nhóm món, hay để tỏi trong món chay, nên không thể ghi thẳng vào Danh mục món như ADR-0004 cho phép với món quản trị viên tự sửa.

Quyết định: mọi món do AI tạo thành một **Món chờ duyệt** trong bảng riêng, ngoài Danh mục món, không công bố cho thiết bị. Quản trị viên mở trong form sửa món, chỉnh, rồi **Duyệt** hoặc **Bỏ**. Duyệt đi qua đúng đường lưu của "thêm món" (cùng `validateDish`, `nextDishId`, cùng một câu lệnh lưu món + tăng phiên bản), nên quy tắc của ADR-0004 cho Danh mục món giữ nguyên: không bản nháp trong danh mục, có hiệu lực ngay khi duyệt. Món bị Bỏ không bị quên: nguồn của nó (đường dẫn) được nhớ để tác nhân không đề xuất lại. Ảnh tải lên chỉ dùng để xử lý rồi bỏ, không lưu ở đâu (món không có trường ảnh, không cần Blob).

Đã cân nhắc và loại bỏ: cho AI ghi thẳng vào danh mục rồi sửa sau (người dùng sẽ thấy món sai trước khi kịp sửa), và thêm cờ "nháp" trên chính món trong danh mục (trộn món chưa duyệt vào bảng công khai, mọi truy vấn công khai phải nhớ lọc).

Hệ quả: `/admin` có tab "Chờ duyệt" (đếm số món chờ, tải ảnh, "Chạy ngay", "Lần chạy gần nhất", "Cài đặt tác nhân"); dữ liệu chờ duyệt và cài đặt tác nhân là dữ liệu của quản trị viên trên máy chủ, không phải dữ liệu cá nhân của người dùng (ADR-0005 không đổi). Nguồn và cảnh báo chỉ hiện ở `/admin`, không bao giờ ở app người dùng.

## Cập nhật (2026-11-08): Ảnh thực đơn thay ảnh công thức

Chủ app đổi hướng: quản trị viên không tải ảnh **công thức** nữa mà tải **Ảnh thực đơn** (1–4 ảnh một danh sách món). Một lần tải giờ có thể tạo **nhiều** Món chờ duyệt: AI đọc tên món, quản trị viên sửa/thêm/chọn tối đa 8 tên, rồi mỗi tên được AI viết công thức riêng (một lần gọi mô hình cho mỗi món, trang gửi lần lượt và hiện tiến độ, nên không lần gọi nào chạm giới hạn thời gian của máy chủ). Tên đã có trong Danh mục món hoặc đang chờ duyệt mặc định không được chọn. Nếu dừng giữa chừng (đóng trang, hết hạn mức miễn phí), các món đã tạo vẫn ở lại, phần còn lại được liệt kê để làm lại; không có hàng đợi chạy nền.

Phần còn nguyên: mọi món vẫn vào Món chờ duyệt trước, Duyệt vẫn đi qua đường lưu của "thêm món" trong một câu lệnh, ảnh vẫn bị bỏ sau khi đọc. Cách đọc ảnh công thức (một ảnh, một món) được gỡ bỏ, không giữ song song.
