# época — Everything at a glance

## Tài liệu UI/UX

> File này mô tả tầm nhìn sản phẩm, thương hiệu, giao diện và trải nghiệm người dùng. Phần kỹ thuật (stack, database, API, kiến trúc) nằm ở `epoca-technical.md`.

---

## 1. Tầm nhìn sản phẩm

- **Tên:** época
- **Tagline:** Everything at a glance
- **Loại ứng dụng:** Personal Life Management & Productivity Workspace

época là workspace quản lý cuộc sống cá nhân, giúp người dùng tập trung công việc, ghi chú, dự án, lịch trình và nhật ký tại một nơi.

### Những câu hỏi người dùng cần trả lời nhanh

- Hôm nay mình cần làm gì?
- Việc nào đang quá hạn hoặc cần ưu tiên?
- Những ghi chú và ý tưởng quan trọng nằm ở đâu?
- Mình đang tiến triển thế nào với các dự án?
- Gần đây mình đã làm gì và đã ghi lại điều gì?

### Nguyên tắc sản phẩm

1. Dashboard cho thấy bức tranh tổng quan trong vài giây.
2. Các module được liên kết với nhau khi có ý nghĩa, không phải những trang CRUD tách rời.
3. Giao diện tối giản, dễ đọc, không quá tải thông tin.
4. Ưu tiên hoàn thiện luồng chính trước khi thêm tính năng nâng cao.

### Định nghĩa thành công (góc nhìn người dùng)

Người dùng mở época và nhanh chóng hiểu hôm nay cần làm gì, tìm lại được ghi chú quan trọng, theo dõi được việc đang tiến triển và xem lại những gì mình đã làm — tất cả trong một workspace thống nhất.

---

## 2. Định hướng thương hiệu và hình ảnh

Web app cao cấp, nhẹ nhàng và thực dụng, lấy cảm hứng từ personal workspace hiện đại.

|Yếu tố|Hướng dẫn|
|---|---|
|Wordmark|Viết thường: **época**|
|Tagline|everything at a glance|
|Nền|Sáng ấm (mặc định)|
|Chữ|Màu than đậm|
|Màu nhấn|Sage green, dusty lavender; tránh neon và gradient rực|
|Typography|Dễ đọc, phân cấp rõ ràng|
|Card|Bo góc vừa phải, border mảnh, shadow rất nhẹ|
|Khoảng trắng|Rộng rãi|
|Viền|Tinh tế|
|Dark mode|Bổ sung sau khi giao diện sáng ổn định (P1)|

### Gợi ý design tokens (có thể điều chỉnh)

- Nền chính: kem/ngà ấm
- Chữ chính: than đậm (không dùng đen tuyền)
- Accent 1: sage green (hành động chính, trạng thái hoàn thành)
- Accent 2: dusty lavender (nhấn phụ, tag, highlight)
- Trạng thái: cảnh báo/quá hạn dùng tông ấm dịu, không đỏ chói

---

## 3. Layout tổng thể

### Sidebar (trái, desktop)

- Overview
- Tasks
- Kanban
- Notes
- Journal
- Calendar
- Projects
- Goals _(placeholder hoặc giai đoạn sau)_
- Settings

Trên màn hình nhỏ: dùng menu responsive (hamburger/drawer hoặc bottom navigation).

### Khu vực chính

- **Header:** tiêu đề trang, ngày hiện tại khi phù hợp, tìm kiếm, thao tác nhanh.
- **Nội dung:** theo từng route.
- Không nhồi tất cả dữ liệu lên một màn hình; dashboard chỉ hiển thị phần quan trọng và có link tới trang chi tiết.

---

## 4. Dashboard (Overview)

### Thành phần

1. **Lời chào và ngày hiện tại.**
2. **Summary cards:** Open Tasks, Completed Tasks, Active Projects, Notes.
3. **Today:** danh sách task cần xử lý (gồm task quá hạn và đến hạn hôm nay).
4. **Coming Up:** sự kiện và deadline sắp tới.
5. **Recently Captured:** note vừa tạo/cập nhật.
6. **Recent Activity:** các hành động gần đây.
7. **Focus Board / mini Kanban:** chỉ khi bố cục còn đủ thoáng.
8. **Quick Capture:** tạo task/note nhanh.

### Quy tắc UX

- Mỗi khối có link "Xem tất cả" tới trang chi tiết.
- Số liệu phải phản ánh dữ liệu thật; trong demo có thể dùng seed data.
- Mỗi khối có đủ trạng thái loading / empty / error.
- Ưu tiên thông tin hành động được (Today) lên vị trí nổi bật nhất.

---

## 5. Trải nghiệm theo từng module

### 5.1. Authentication

- Màn hình đăng ký, đăng nhập đơn giản, đúng thương hiệu.
- Validate email/mật khẩu với thông báo lỗi rõ ràng, thân thiện.
- Có nút đăng xuất dễ thấy (sidebar hoặc menu người dùng).
- Người dùng chưa đăng nhập được chuyển hướng về trang đăng nhập; sau khi đăng nhập quay lại trang đang định vào.

### 5.2. Tasks

- Danh sách task với: tiêu đề, trạng thái, mức ưu tiên, deadline, tag.
- Tạo/sửa task qua form hoặc modal/drawer; chỉ `title` là bắt buộc.
- Đánh dấu hoàn thành nhanh bằng checkbox/nút.
- **Lọc** theo trạng thái và mức ưu tiên; **tìm kiếm** theo tiêu đề.
- Phân biệt trực quan task **quá hạn** và task **đến hạn hôm nay**.
- Xác nhận trước khi xóa.
- Phân trang hoặc giới hạn hợp lý khi dữ liệu lớn.

### 5.3. Kanban

- Ba cột: **To do**, **In progress**, **Done**.
- Task card hiển thị: tiêu đề, ưu tiên, deadline.
- Đổi trạng thái bằng nút/menu trước; **kéo-thả là tính năng bổ sung**.
- Nếu có kéo-thả: cập nhật lạc quan (optimistic) phải hoàn tác và báo lỗi rõ khi lưu thất bại.
- Có loading/error state và phản hồi rõ khi cập nhật thất bại.

### 5.4. Notes

- Danh sách dạng card/lưới hoặc danh sách; note được ghim nằm trên cùng.
- Tìm kiếm theo tiêu đề và nội dung; lọc theo tag.
- Hiển thị thời gian cập nhật gần nhất.
- Ghim/bỏ ghim bằng một thao tác.
- Editor: textarea hoặc editor đơn giản; Markdown là phần mở rộng (P1).

### 5.5. Journal _(P1)_

- Tạo và sửa nhật ký theo ngày; xem các entry gần đây.
- Chọn mood (tùy chọn) bằng bộ chọn đơn giản.
- Tránh tạo trùng ngày ngoài ý muốn: nếu ngày đã có entry, mở entry đó để sửa thay vì tạo mới.
- Journal là nội dung người dùng tự viết, khác Activity Log do hệ thống ghi — giao diện cần tách biệt rõ.

### 5.6. Activity Log

- Hiển thị dạng timeline ngắn gọn trên Dashboard (Recent Activity).
- Mỗi dòng: hành động + summary ngắn + thời gian tương đối.
- Không hiển thị nội dung riêng tư; chỉ tiêu đề/tóm tắt.

### 5.7. Projects _(P1)_

- Danh sách project và trang chi tiết.
- Hiển thị tiến độ **dựa trên số task** (ví dụ "3/8 task hoàn thành"); ghi rõ đây là chỉ số theo số lượng, không khẳng định phản ánh mọi mục tiêu.
- Trang chi tiết liệt kê task và note liên kết.

### 5.8. Calendar và Events _(P1)_

- Lịch tháng đơn giản hoặc danh sách theo ngày.
- Hiển thị deadline task và event cá nhân.
- Tạo/sửa/xóa event; báo lỗi rõ nếu giờ kết thúc sớm hơn giờ bắt đầu.
- Hiển thị giờ theo múi giờ của người dùng.

### 5.9. Goals _(P2 / placeholder)_

- Mục menu có thể hiển thị trang "Sắp ra mắt".
- Nếu triển khai: mục tiêu, deadline, trạng thái, milestones.

### 5.10. Quick Capture

- Ít trường bắt buộc (task: chỉ tiêu đề; note: tiêu đề hoặc nội dung ngắn).
- Truy cập được từ Dashboard và header (nút "+" hoặc phím tắt).
- Sau khi lưu: dashboard cập nhật ngay và hiện thông báo thành công/thất bại (toast).
- Không bắt người dùng mở nhiều trang chỉ để ghi lại một ý tưởng.

### 5.11. Settings

- Tùy chọn cơ bản: tên, theme (khi có dark mode), múi giờ.

---

## 6. Trạng thái giao diện (bắt buộc cho mọi màn hình dữ liệu)

|Trạng thái|Yêu cầu|
|---|---|
|**Loading**|Skeleton hoặc spinner nhẹ, tránh nhảy layout|
|**Empty**|Thông điệp thân thiện + lời gọi hành động (ví dụ "Tạo task đầu tiên")|
|**Error**|Thông báo dễ hiểu + nút thử lại; không hiện stack trace|
|**Success**|Toast ngắn gọn sau thao tác thành công|
|**Submitting**|Vô hiệu hóa nút gửi, tránh submit trùng|

---

## 7. Responsive và Accessibility

### Responsive

- Hoạt động tốt trên laptop và điện thoại.
- Sidebar desktop → menu responsive trên màn hình nhỏ.
- Kanban trên mobile: cuộn ngang hoặc xếp cột theo tab.
- Vùng bấm đủ lớn trên thiết bị cảm ứng.

### Accessibility

- Focus state rõ ràng, điều hướng được bằng bàn phím.
- Mọi input form có `label`.
- Độ tương phản chữ/nền đạt mức phù hợp (WCAG AA là mục tiêu).
- Không chỉ dùng màu để truyền đạt trạng thái (kèm icon/nhãn chữ).
- Thông báo lỗi form gắn với trường tương ứng.
- Icon đơn thuần có `aria-label` khi đóng vai trò nút.

---

## 8. Form và phản hồi

- Validate ngay trên form với thông báo lỗi rõ ràng, tiếng Việt thân thiện (hoặc theo ngôn ngữ giao diện được chọn).
- Xác nhận trước thao tác phá hủy (xóa task, note, project, event).
- Toast cho kết quả thao tác; không dùng `alert()`.
- Dùng bộ component UI nhất quán (Button, Input, Select, Modal/Drawer, Card, Badge, Toast, Skeleton, EmptyState).

---

## 9. Tiêu chí nghiệm thu về UI/UX

- Dashboard cho thấy việc hôm nay, việc sắp tới, note mới và hoạt động gần đây trong vài giây.
- Người dùng đổi trạng thái task qua Kanban và thấy kết quả ngay.
- Người dùng tạo, sửa, xóa, tìm kiếm note dễ dàng.
- Các form có validation và thông báo lỗi rõ ràng.
- Có trạng thái loading, empty và error ở mọi nơi tải dữ liệu.
- Giao diện hoạt động trên laptop và điện thoại.
- Quick Capture tạo task/note chỉ trong vài giây và dashboard cập nhật.

---

## 10. Thứ tự ưu tiên giao diện

**P0 — Bắt buộc:** App shell + sidebar, Auth, Tasks, Kanban 3 cột, Notes, Dashboard, trạng thái loading/empty/error, responsive.

**P1 — Nếu còn thời gian:** Projects, Journal, Calendar/Events, bộ lọc nâng cao, Markdown cho Notes, dark mode.

**P2 — Để sau:** Goals/habits, dashboard widget tùy chỉnh.

> Không bắt đầu P1/P2 khi P0 chưa chạy ổn định từ đầu đến cuối.

---

_Build the smallest complete version of época first. Make it useful, reliable, and calm to use._