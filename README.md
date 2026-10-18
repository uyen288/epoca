# época — everything at a glance

época là không gian làm việc cá nhân local-first, giao diện tiếng Việt, gộp công việc, lịch, nhật ký và ghi chú vào một ứng dụng. MVP không có tài khoản, backend, dịch vụ đám mây hay tự đồng bộ.

## Yêu cầu môi trường

- Node.js 20.19+ hoặc 22.12+, npm.
- Để chạy/build desktop Windows: Rust stable (Tauri SQL yêu cầu Rust 1.90+), Microsoft C++ Build Tools và WebView2 Runtime. Xem [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Chạy web

```powershell
npm install
npm run dev
```

Build và kiểm tra:

```powershell
npm run test
npm run lint
npm run build
npm run preview
```

Web lưu dữ liệu trong **IndexedDB của trình duyệt hiện tại**. Xóa dữ liệu trang web/trình duyệt có thể làm mất dữ liệu; hãy xuất backup thường xuyên.

## Cài época và dùng ngoại tuyến

época là PWA. Trên Chrome/Edge, mở ứng dụng trên HTTPS (localhost được xem là an toàn khi phát triển), rồi dùng nút **Install época** trong thanh trên cùng hoặc chọn lệnh cài đặt của trình duyệt. Nút trong ứng dụng mở hướng dẫn thủ công nếu trình duyệt không hỗ trợ `beforeinstallprompt`; Safari trên iPhone/iPad dùng Chia sẻ → Thêm vào Màn hình chính. Firefox và các trình duyệt khác có thể không hỗ trợ cài ứng dụng.

Để thử trên máy phát triển, chạy `npm run dev` và mở địa chỉ localhost. Để thử đúng app-shell/offline cache production:

1. Chạy `npm run build`, sau đó `npm run preview` và mở địa chỉ localhost của preview trong Chrome/Edge.
2. Tải ứng dụng thành công một lần, chờ service worker kích hoạt (DevTools → Application → Service Workers), rồi cài ứng dụng từ nút trên trang hoặc menu trình duyệt.
3. Trong DevTools → Network, bật **Offline** rồi tải lại trang. App shell đã precache sẽ mở; dữ liệu cá nhân vẫn được đọc từ IndexedDB cục bộ. Tắt Offline để trở lại mạng.

Service worker chỉ precache HTML, mã ứng dụng, stylesheet và tài sản tĩnh. Nó không lưu vào cache dữ liệu IndexedDB, thông tin cá nhân hay phản hồi API. Xuất backup trước khi xóa dữ liệu trang web vì thao tác đó xóa cả IndexedDB và cache.

Production phải được phục vụ qua HTTPS để trình duyệt cho phép service worker và cài đặt PWA; Vercel cung cấp HTTPS cho domain triển khai. Với hosting tùy chỉnh, bật HTTPS/redirect HTTP sang HTTPS. Trình duyệt quyết định có hiển thị biểu tượng cài đặt gốc hay không; giao diện época không cố mô phỏng biểu tượng đó.

## Chạy và build desktop Windows

```powershell
npm install
npm run tauri:dev
npm run tauri:build
```

`tauri:build` tạo bộ cài NSIS trong `src-tauri/target/release/bundle/nsis/`. Bản desktop lưu trong SQLite (`epoca.db`) tại thư mục cấu hình ứng dụng của Tauri trên thiết bị. Tệp database không nằm trong thư mục cài ứng dụng nên không bị ghi đè khi cập nhật.

Web và desktop là hai bản cài riêng: chúng **không tự đồng bộ** và dùng kho lưu trữ độc lập. Để chuyển dữ liệu, dùng Settings → Dữ liệu & sao lưu → Xuất bản sao lưu ở nơi nguồn, rồi nhập tệp JSON ở nơi đích. Import kiểm tra schema và các quan hệ trước, sau đó thay thế toàn bộ dữ liệu cục bộ.

## Những gì có trong MVP

- Dashboard tổng hợp task hôm nay, quá hạn, lịch sắp tới, hoàn thành tuần này, biểu đồ 7 ngày và streak nhật ký. Heatmap hoạt động có các chế độ tuần/tháng/năm/toàn bộ, tính từ nhật ký đã lưu và task hoàn thành.
- Todo: CRUD, trạng thái, ưu tiên, deadline, lịch, nhãn, bộ lọc và tìm kiếm.
- Kanban: bốn cột task dùng chung bản ghi với Todo; có kéo thả và menu trạng thái thay thế.
- Calendar: tháng/tuần/ngày/agenda, sự kiện độc lập, deadline trong agenda, chỉnh sửa và kéo lịch sang ngày khác.
- Journal: một entry/ngày local, mood, prompt nội bộ, lưu chủ động và streak chỉ tính ngày có nội dung.
- Spaces: thư mục một cấp, ghi chú, ghim, chuyển thư mục, tìm kiếm và autosave có trạng thái.
- Settings: theme, thiết lập lịch, sao lưu/khôi phục, xóa dữ liệu và thông tin quyền riêng tư.

## Cấu trúc dữ liệu và đánh đổi

- `src/data/models.ts`: entity và kiểu dùng chung.
- `src/data/repository.ts`: hợp đồng repository; `src/data/adapters/` chứa IndexedDB và SQLite adapters.
- `src/lib/domain.ts`: validation, ngày local, streak và kiểm tra backup dùng chung.
- `src/App.tsx` và `src/App.css`: app shell, các màn hình theo khu vực và design system UI.
- Desktop dùng Tauri 2 + SQL plugin. SQLite giữ một snapshot JSON trong bảng `app_state`; thao tác thay toàn bộ backup là một lần ghi nguyên tử. `schema_meta` và migration SQL được cấu hình ngay cả khi chưa có bảng nghiệp vụ riêng.
- Giao diện được xây bằng CSS design system nhỏ và Tailwind CSS v4; kéo thả dùng HTML Drag and Drop API để tránh thêm thư viện cho MVP.
- Web có thể mở app shell offline sau lần tải thành công đầu tiên nhờ service worker; dữ liệu tiếp tục được lưu cục bộ trong IndexedDB.
- Nhắc hạn task là trạng thái trong giao diện, không phải push notification khi ứng dụng đóng. Các dữ liệu vẫn được lưu cục bộ; không gửi nội dung ra dịch vụ ngoài.

## Kiểm thử

`npm run test` chạy kiểm tra quy tắc domain và adapter IndexedDB giả lập: validation lịch, đồng bộ trạng thái hoàn thành, streak, backup/quan hệ, CRUD, thay thế và xóa dữ liệu. Tauri binary cần được build thêm trên máy có Rust và Windows build tools.
