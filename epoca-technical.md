# época — Everything at a glance

## Tài liệu kỹ thuật (React + Node.js)

> File này mô tả stack, kiến trúc, database, API, bảo mật, kế hoạch triển khai và tiêu chí nghiệm thu kỹ thuật. Phần giao diện và trải nghiệm nằm ở `epoca-uiux.md`.

---

## 0. Vai trò và phạm vi

Bạn là một kỹ sư phần mềm full-stack senior. Hãy xây dựng ứng dụng **época — Everything at a glance** như một **ứng dụng chạy được thật**, không chỉ mockup hoặc giao diện tĩnh. Ưu tiên MVP hoàn chỉnh, code rõ ràng, phạm vi phù hợp với một người phát triển trong khoảng 3–4 tuần.

---

## 1. Stack công nghệ

### Frontend

- React + Vite
- TypeScript (ưu tiên nếu dự án chưa bắt đầu; nếu repo hiện tại dùng JavaScript thì tiếp tục theo chuẩn hiện có)
- React Router
- Tailwind CSS
- Axios hoặc fetch API
- TanStack Query (server state/cache, nếu phù hợp)
- React Hook Form + Zod (form và validation, nếu phù hợp)
- Lucide React (icon)
- Recharts — chỉ khi cần biểu đồ
- dnd-kit — chỉ khi triển khai kéo-thả Kanban

### Backend

- Node.js + Express.js
- REST API với prefix `/api/v1`
- MongoDB + Mongoose (mặc định)
- JWT cho xác thực
- bcrypt hoặc bcryptjs để hash mật khẩu
- Zod hoặc express-validator để validate
- dotenv
- Helmet, CORS cấu hình rõ ràng, giới hạn request phù hợp

### Công cụ

- npm, Git
- Postman hoặc tương đương để kiểm thử API

> Không thêm thư viện chỉ để cho đủ stack. Ưu tiên dependency ít, ổn định, có lý do rõ ràng.

---

## 2. Kiến trúc code

### Cấu trúc repository

```
epoca/
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── ui/
│   │   │   ├── dashboard/
│   │   │   ├── tasks/
│   │   │   └── notes/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── tasks/
│   │   │   ├── notes/
│   │   │   ├── journal/
│   │   │   ├── projects/
│   │   │   └── dashboard/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── main.jsx
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middlewares/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

### Luồng backend

```
routes → middleware → controllers → services → models
```

Không áp dụng kiến trúc phức tạp hay abstraction dư thừa. Tách module theo nghiệp vụ để dễ đọc, sửa và kiểm thử.

---

## 3. Guest workspace và bảo mật

### Trải nghiệm mặc định

- Không bắt buộc đăng nhập: ứng dụng mở thẳng dashboard trong guest workspace.
- Client tạo workspace id ngẫu nhiên, lưu trong local storage và gửi qua header `X-Workspace-Id`; task, note và activity được giới hạn theo id này.
- Guest workspace chỉ giúp tách dữ liệu giữa các trình duyệt thông thường, **không phải cơ chế xác thực hoặc bảo vệ dữ liệu**. Không dùng cho dữ liệu nhạy cảm.
- Các endpoint tài khoản có thể được giữ làm chức năng tùy chọn; nếu bật, hash mật khẩu bằng bcrypt và validate email/mật khẩu.
- **Không bao giờ** trả `passwordHash` trong response.

### Session tài khoản tùy chọn

Cấu hình rõ thời hạn token và cách lưu token nếu triển khai luồng tài khoản.

- **Cookie:** `HttpOnly`, `Secure` ở production, `SameSite` phù hợp.
- **Bearer token:** ghi rõ trade-off (dễ bị XSS đánh cắp nếu lưu ở localStorage) và tránh lưu dữ liệu nhạy cảm tùy tiện.

### Quy tắc bảo mật dữ liệu

- Với tài khoản đã xác thực, mọi truy vấn dữ liệu cá nhân giới hạn theo `userId` lấy từ token/session — **không tin `userId` do client gửi**.
- `X-Workspace-Id` của guest workspace do client gửi không chứng minh danh tính và có thể bị giả mạo; muốn bảo vệ dữ liệu cần xác thực và phân quyền phía server.
- Kiểm tra quyền sở hữu trước khi đọc, cập nhật hoặc xóa document.
- Validate ObjectId và dữ liệu đầu vào ở backend kể cả khi frontend đã validate.
- Không trả các trường nội bộ nhạy cảm.
- Không trả stack trace cho client ở production; error message an toàn, dễ hiểu.
- Không commit `.env` hoặc secret.
- Helmet, CORS cấu hình rõ, giới hạn kích thước request.

---

## 4. Database (MongoDB + Mongoose)

Chỉ tạo collection khi module tương ứng được triển khai.

### users

- `name`
- `email` (unique, normalized)
- `passwordHash`
- `settings` (theme, timezone nếu cần)
- timestamps

### tasks

- `userId` (ObjectId, indexed)
- `title` (bắt buộc)
- `description`
- `status`: `todo` | `in_progress` | `done`
- `priority`: `low` | `medium` | `high`
- `dueDate` (tùy chọn)
- `tags` (mảng chuỗi)
- `projectId` (nullable)
- timestamps

### notes

- `userId` (indexed)
- `title`, `content`
- `tags`
- `isPinned`
- `projectId` (nullable)
- timestamps

### journals

- `userId` (indexed)
- `date`, `content`
- `mood` (optional)
- timestamps

### projects

- `userId` (indexed)
- `name`, `description`
- `status`: `active` | `completed` | `archived`
- `deadline` (tùy chọn)
- timestamps

### events

- `userId` (indexed)
- `title`, `description`
- `startAt`, `endAt`
- timestamps

### activityLogs

- `userId` (indexed)
- `action`
- `entityType`, `entityId`
- `summary` (ngắn gọn)
- `createdAt`

### Index gợi ý

- `userId + status`
- `userId + dueDate`
- `userId + updatedAt`

### Quy tắc dữ liệu

- Dùng timestamps tự động.
- Khi project bị xóa mà task/note còn tham chiếu: chọn quy tắc rõ ràng (ví dụ đặt `projectId = null`).
- Không lưu dữ liệu tổng hợp trùng lặp nếu có thể tính từ dữ liệu gốc (ví dụ tiến độ project = tính từ task).
- **Journal:** xác định rõ quy tắc một entry/ngày hoặc nhiều entry/ngày (khuyến nghị: một entry/ngày, unique index `userId + date`).
- **Events:** lưu timestamp chuẩn (UTC), hiển thị theo múi giờ người dùng; validate `endAt >= startAt`.
- Project progress dựa trên `completedTasks / totalTasks` — ghi rõ đây là chỉ số theo số lượng task.

---

## 5. REST API

Prefix: `/api/v1`. Dùng HTTP status code phù hợp, response format nhất quán.

### Auth

|Method|Endpoint|Ghi chú|
|---|---|---|
|POST|`/auth/register`||
|POST|`/auth/login`||
|POST|`/auth/logout`|nếu dùng cookie/session|
|GET|`/auth/me`||

### Dashboard

|Method|Endpoint|
|---|---|
|GET|`/dashboard/summary`|

Response gồm:

- Summary counts
- Tasks hôm nay và task quá hạn
- Upcoming events
- Recently updated notes
- Recent activities

> Không tải tất cả records về frontend chỉ để tính số liệu tổng hợp — dùng aggregation/count ở backend.

### Tasks

`GET /tasks` · `POST /tasks` · `GET /tasks/:id` · `PATCH /tasks/:id` · `DELETE /tasks/:id`

Query params: `status`, `priority`, `search`, `dueDate`, `projectId`, `page`, `limit`.

### Notes

`GET /notes` · `POST /notes` · `GET /notes/:id` · `PATCH /notes/:id` · `DELETE /notes/:id`

Hỗ trợ tìm kiếm theo tiêu đề + nội dung, lọc theo tag, ghim/bỏ ghim.

### Journals

`GET /journals` · `POST /journals` · `GET /journals/:id` · `PATCH /journals/:id` · `DELETE /journals/:id`

### Projects

`GET /projects` · `POST /projects` · `GET /projects/:id` · `PATCH /projects/:id` · `DELETE /projects/:id`

### Events

`GET /events` · `POST /events` · `GET /events/:id` · `PATCH /events/:id` · `DELETE /events/:id`

### Activity Log

`GET /activity-logs`

---

## 6. Activity Log (quy tắc backend)

Ghi lại các hành động quan trọng:

- Tạo task, cập nhật task, hoàn thành task
- Tạo hoặc cập nhật note
- Tạo project

Quy tắc:

- Log được tạo **từ backend, sau khi thao tác nghiệp vụ thành công**.
- Không ghi các hành động vụn vặt không có ích.
- Không để log làm lộ nội dung riêng tư; `summary` chỉ là mô tả ngắn (ví dụ tiêu đề).
- Khác Journal: Activity Log do hệ thống tự ghi.

---

## 7. MVP và thứ tự ưu tiên

### P0 — Bắt buộc

1. Khởi tạo frontend/backend và kết nối database.
2. Đăng ký, đăng nhập, bảo vệ API.
3. Tasks CRUD, status, priority, deadline.
4. Kanban ba cột.
5. Notes CRUD và tìm kiếm cơ bản.
6. Activity Log cho thao tác quan trọng.
7. Dashboard lấy dữ liệu thật từ API.
8. Kiểm tra quyền sở hữu dữ liệu.
9. Loading, error, empty states.
10. Responsive layout.

### P1 — Nếu còn thời gian

1. Projects và liên kết task/note.
2. Journal.
3. Calendar và Events.
4. Bộ lọc nâng cao.
5. Markdown cho Notes.
6. Dark mode.

### P2 — Để sau

1. Goals và habits đầy đủ.
2. Nhắc việc qua email/push.
3. Đồng bộ lịch bên ngoài.
4. AI assistant.
5. Chia sẻ dự án / cộng tác nhóm.
6. Tùy chỉnh widget dashboard.

> Không bắt đầu P1/P2 khi P0 chưa chạy ổn định từ đầu đến cuối.

---

## 8. Kế hoạch 3–4 tuần

**Tuần 1 — Foundation**

- Khởi tạo repo, frontend, backend; kết nối MongoDB.
- Schema User và Task.
- Đăng ký, đăng nhập, middleware xác thực.
- Task CRUD.
- App shell, sidebar, routing.

**Tuần 2 — Core workspace**

- Task list, filters và Kanban.
- Notes CRUD và search.
- Activity Log.
- Kết nối API, xử lý loading/error.
- Kiểm tra phân quyền.

**Tuần 3 — Dashboard**

- Dashboard summary API.
- Quick Capture.
- Recently updated notes và recent activity.
- Projects cơ bản.
- Hoàn thiện responsive.

**Tuần 4 — Polish và nộp bài**

- Journal hoặc Calendar nếu còn thời gian.
- Kiểm thử luồng chính, sửa lỗi, kiểm tra dữ liệu.
- Seed data cho demo.
- Deploy frontend/backend/database.
- README, sơ đồ database, tài liệu API và báo cáo.

> Nếu chỉ còn 2–3 tuần: bỏ các module chưa thiết yếu, tập trung P0.

---

## 9. Tiêu chí nghiệm thu kỹ thuật

- Đăng ký, đăng nhập, đăng xuất hoạt động.
- CRUD task hoạt động và dữ liệu còn sau khi tải lại trang.
- Đổi trạng thái task qua Kanban được lưu qua API.
- Tạo, sửa, xóa, tìm kiếm note hoạt động.
- Dashboard hiển thị số liệu đúng với database.
- Activity Log ghi lại các hành động quan trọng.
- **Người dùng A không thể truy cập dữ liệu của người dùng B bằng cách thay ID trên request.**
- Backend validate dữ liệu và trả lỗi rõ ràng.
- Có `.env.example`, README hướng dẫn chạy local và dữ liệu demo.

---

## 10. Chất lượng code

- Code dễ đọc, tên biến/hàm rõ nghĩa.
- Tránh component quá lớn; chia theo trách nhiệm.
- Không lặp logic gọi API (tập trung ở `services/`).
- Không hard-code URL backend; dùng biến môi trường.
- Không commit `.env` hoặc secret; không lưu mật khẩu plaintext.
- Validate dữ liệu ở backend kể cả khi frontend đã validate.
- Xử lý lỗi tập trung ở backend (error-handling middleware).
- Kiểm tra quyền sở hữu ở mọi endpoint cần xác thực.
- Không dùng dữ liệu giả làm kết quả cuối; seed data chỉ phục vụ demo.
- **Không tuyên bố tính năng đã hoàn thành nếu chưa chạy thử.**
- README có hướng dẫn setup và lệnh chạy thực tế.

---

## 11. Quy trình làm việc với AI coding agent

Triển khai theo từng giai đoạn, không tạo toàn bộ hệ thống trong một lần.

1. Kiểm tra repository hiện có trước khi sửa; không ghi đè code đang hoạt động khi chưa hiểu cấu trúc.
2. Đưa ra kế hoạch ngắn và các quyết định kỹ thuật cần thiết.
3. Khởi tạo skeleton, xác minh frontend/backend chạy được.
4. Hoàn thiện Authentication và Tasks end-to-end.
5. Kiểm thử API, sau đó mới làm Kanban và Notes.
6. Thêm Activity Log và Dashboard dựa trên dữ liệu thật.
7. Bổ sung Projects, Journal, Calendar theo thời gian còn lại.
8. Chạy build/lint/test nếu đã cấu hình; sửa lỗi phát sinh.
9. Cập nhật README: biến môi trường, lệnh chạy, schema, endpoint.
10. Cuối mỗi giai đoạn, báo cáo: file đã tạo/sửa, tính năng đã kiểm tra, vấn đề còn tồn tại, bước tiếp theo.

Khi có quyết định chưa xác định, chọn phương án đơn giản, an toàn, phù hợp MVP; ghi giả định vào README thay vì mở rộng phạm vi.

---

_Build the smallest complete version of época first. Make it useful, reliable, and calm to use._