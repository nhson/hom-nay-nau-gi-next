# Dữ liệu cá nhân ở lại trên thiết bị; máy chủ chỉ công bố Danh mục món

ADR-0001 dự định một backend lưu dữ liệu của cả "hộ gia đình" dưới một link chung. Ta bỏ ý tưởng đó và bỏ luôn khái niệm "Hộ gia đình": không có hộ, không có mã/link chia sẻ, không có đồng bộ giữa các thiết bị. Lịch sử, yêu thích, thực đơn hôm nay và danh sách đi chợ chỉ nằm trong IndexedDB trên từng máy.

Máy chủ chỉ làm hai việc: công bố **Danh mục món** (đọc công khai, có ETag) và, cho **Quản trị viên** duy nhất, cập nhật danh mục đó (ADR-0004). Không có tài khoản người dùng.

Lý do: không cần đăng nhập hay xử lý xung đột, không lưu dữ liệu cá nhân phía máy chủ (không rủi ro quyền riêng tư), và mô hình đúng với cách app đã chạy ở Phase 1. Đổi lại ta mất khả năng dùng chung lịch sử/yêu thích giữa các máy trong nhà; nếu cần sau này, đó là một quyết định mới, không phải phần còn dở của ADR-0001.

Thay thế ADR-0001. Các tính năng F16–F20, N4 trong `docs/features.md` được ghi là đã bỏ.
