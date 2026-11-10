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

**Món chờ duyệt**:
Một món được đề xuất, chưa vào Danh mục món: do AI viết (từ một **Ảnh thực đơn** hoặc tên món quản trị viên gõ), do **Tác nhân thu thập** lấy từ một **Nguồn công thức**, hoặc từ một **Nhập từ file** (không dùng AI); đang chờ **Quản trị viên** xem. Nằm riêng, ngoài **Danh mục món**: người dùng không bao giờ thấy, không được gợi ý. Quản trị viên mở món trong form sửa món, chỉnh rồi **Duyệt** (món vào Danh mục món với mã `x*`/`c*`/`m*`/`t*` như món thêm tay, phiên bản danh mục tăng) hoặc **Bỏ** (món bị loại, nguồn của nó được nhớ để không đề xuất lại). Mỗi món ghi nguồn (đường dẫn trang, "Ảnh thực đơn", hoặc "Nhập từ file · tên file") và các cảnh báo (vd. "có thể trùng với c12", "món chay có nhắc tỏi"). Xem [ADR-0006](docs/adr/0006-ai-proposed-dishes-wait-for-review.md).
_Avoid_: Bản nháp, Draft, Hàng đợi (trong chữ hiển thị) — Danh mục món vẫn không có bản nháp.

**Ảnh thực đơn**:
1–4 ảnh một thực đơn (thực đơn quán, thực đơn tuần viết tay, ảnh chụp màn hình một danh sách món) mà **Quản trị viên** tải lên trang quản trị. AI chỉ đọc **tên món** (bỏ giá, tiêu đề mục, đồ uống, tráng miệng) thành một danh sách; quản trị viên sửa, bỏ hoặc gõ thêm tên, chọn tối đa 8 món (món đã có trong Danh mục món hoặc đang chờ duyệt mặc định không chọn), rồi bấm "Tạo món". Với mỗi tên được chọn, AI **tự viết** một công thức nấu tại nhà (khoảng 4 người, nguyên liệu có định lượng, các bước ngắn, đúng quy tắc chay) thành một **Món chờ duyệt** có cảnh báo "AI tự viết công thức, hãy kiểm tra". Ảnh bị bỏ sau khi đọc. Xem [ADR-0006](docs/adr/0006-ai-proposed-dishes-wait-for-review.md).
_Avoid_: Ảnh công thức (cách cũ, đã thay), Menu (trong chữ hiển thị).

**Nhập từ file**:
Cách thêm nhiều món một lúc, là một thẻ của trang Thêm món (cạnh "Ảnh thực đơn / Gõ tên"): **Quản trị viên** tải lên một file JSON (dạng file Xuất JSON, hoặc chỉ một danh sách món). Chỉ tên món là bắt buộc; Kiểu bữa ăn, Nhóm món, Vùng miền nhận cả mã (`buacom`, `canh`, `nam`) lẫn chữ tiếng Việt, có hay không dấu. Trang cho xem trước (sẽ thêm, bỏ qua và vì sao, cảnh báo) rồi thêm các món thành **Món chờ duyệt**. Món trùng tên với Danh mục món (cả món đã ẩn) hoặc Chờ duyệt bị bỏ qua; file không bao giờ sửa hay ẩn món đã có. Không dùng AI.
_Avoid_: Import, Tải lên hàng loạt (trong chữ hiển thị; tên trong mã như `/admin/import` vẫn dùng "import").

**Tổng quan**:
Trang đầu của trang quản trị (`/admin`): phiên bản và số món của **Danh mục món** (đang dùng, đã ẩn, theo Nhóm món và Bữa 1 món), số **Món chờ duyệt**, lần chạy gần nhất của **Tác nhân thu thập**, và lối tắt Thêm món, Chạy ngay, Chờ duyệt.
_Avoid_: Dashboard, Trang chủ (trong chữ hiển thị).

**Nguồn công thức**:
Một trang web công thức tiếng Việt mà **Tác nhân thu thập** được phép đọc: hiện là monngonmoingay.com (chính) và mục nấu ăn của vnexpress.net. Danh sách nằm trong mã, đổi bằng PR. Chỉ dùng trang tiếng Việt cho phép thu thập (robots.txt) và không chặn bot AI. Xem [ADR-0007](docs/adr/0007-recipe-sources-and-free-models-via-openrouter.md).

**Tác nhân thu thập**:
Việc chạy tự động mỗi ngày (khoảng 05:00 giờ Việt Nam, hoặc khi quản trị viên bấm "Chạy ngay") đọc các trang mới trong **Nguồn công thức**, dùng AI chuyển trang thành món (trích, phân loại, viết lại các bước gọn bằng lời của mình), ưu tiên món lấp chỗ trống trong Danh mục món, rồi thêm thành **Món chờ duyệt**. Không tự bịa món: mọi món đều có trang gốc. Số món mỗi ngày, ngưỡng tạm dừng khi có nhiều món chờ và số trang đọc mỗi lần do quản trị viên chỉnh trong "Cài đặt tác nhân".
_Avoid_: Bot, Crawler, Agent (trong chữ hiển thị).

**Giao diện**:
Cách app hiện màu: **Sáng**, **Tối** hoặc **Theo thiết bị** (mặc định, theo cài đặt sáng/tối của máy). Người dùng chọn bằng nút "Giao diện" ở thanh đầu trang của app và của trang quản trị; lựa chọn lưu trên từng thiết bị, dùng chung cho cả app và trang quản trị, không gửi lên máy chủ và không thuộc dữ liệu cá nhân (lịch sử, yêu thích). Khi chọn Sáng hoặc Tối, cả màu thanh trạng thái/thanh địa chỉ và ô nhập liệu cũng theo lựa chọn đó.
_Avoid_: Chế độ tối, Dark mode, Theme — dùng "Giao diện" và ba giá trị trên.
