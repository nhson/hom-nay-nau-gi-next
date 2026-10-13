# Backend là nơi lưu tập trung, không có cơ chế đồng bộ giữa các phiên

App hiện chỉ lưu `localStorage` (mất dữ liệu khi xoá cache, không chia sẻ được giữa các thiết bị trong nhà). Ta quyết định thêm backend để dữ liệu của một Hộ gia đình được lưu tập trung, truy cập qua một mã/link hộ gia đình không cần tài khoản cá nhân.

Backend này **chỉ đóng vai trò lưu trữ** — không có real-time sync, không có push/pull giữa các phiên đang mở, không có cơ chế xử lý xung đột khi nhiều thiết bị sửa cùng lúc (không last-write-wins có chủ đích, không merge). Mỗi phiên đọc dữ liệu hiện có khi mở app và ghi đè khi có thay đổi, tương tự cách `localStorage` hoạt động hôm nay nhưng ở một nơi lưu chung thay vì cục bộ từng thiết bị.

Lý do: tần suất dùng và số người dùng đồng thời trong 1 hộ gia đình rất thấp, nên rủi ro xung đột gần như không xảy ra trong thực tế — xây cơ chế đồng bộ/merge cho tình huống hiếm là làm quá tay so với nhu cầu thật.
