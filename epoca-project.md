# época — Tài liệu dự án MVP 0.1

> **Tagline:** everything at a glance
> **Sản phẩm:** Không gian làm việc cá nhân (personal life workspace)
> **Phạm vi:** Web app demo được + ứng dụng desktop Windows tải về được
> **Ngôn ngữ giao diện:** Tiếng Việt trước, cấu trúc sẵn để thêm tiếng Anh
> **Phiên bản:** MVP 0.1

Tài liệu này hợp nhất `epoca-mvp-spec.md` và `epoca-agent-brief.md` thành một nguồn duy nhất cho cả người và AI agent triển khai. Khi hai file gốc khác nhau, tài liệu này nêu rõ quyết định đã chọn (xem mục 15).

---

## 1. Tổng quan sản phẩm

época gom **công việc, lịch, nhật ký và ghi chú** vào một nơi, để người dùng nhìn ra và sắp xếp được ngày của mình chỉ trong một cái nhìn, mà không phải nhập cùng một thông tin nhiều lần.

Sản phẩm có **sáu khu vực**:

| # | Khu vực | Vai trò |
|---|---|---|
| 1 | **Dashboard** | Tổng quan hôm nay và tiến độ gần đây |
| 2 | **Todo** | Tạo và quản lý task, deadline, lịch, ưu tiên, nhãn |
| 3 | **Kanban** | Cùng các task đó, kéo thả theo cột trạng thái |
| 4 | **Calendar** | Task đã lên lịch + sự kiện độc lập |
| 5 | **Journal** | Nhật ký ngày, tâm trạng, câu hỏi gợi ý |
| 6 | **Spaces** | Thư mục và ghi chú |

### Nguyên tắc cốt lõi

**Một task là một bản ghi duy nhất, hiển thị ở nhiều view.** Todo, Kanban và Calendar không được tạo bản sao của task. Sửa ở view nào thì các view còn lại tự cập nhật.

**Event là bản ghi riêng**, vì một sự kiện lịch không nhất thiết là việc cần hoàn thành. Journal và Note cũng là bản ghi độc lập, không bị ép gắn với task.

Đây là MVP **local-first** cho **một người dùng trên một bản cài đặt**.

---

## 2. Phạm vi và ràng buộc

### 2.1 Bắt buộc

- Dữ liệu chỉ lưu cục bộ (local storage).
- Web: lưu trong **IndexedDB** (khuyến nghị Dexie).
- Desktop: đóng gói cùng UI React bằng **Tauri**, lưu trong **SQLite** cục bộ.
- Web và desktop có **cơ sở dữ liệu riêng, không tự đồng bộ**. UI và README phải nói rõ điều này.
- Có **Export Backup / Import Backup** bằng JSON có đánh phiên bản, để sao lưu hoặc chuyển dữ liệu thủ công giữa web và desktop.
- Dùng chung domain model và business rules cho cả hai build. Truy cập dữ liệu qua một **repository/storage interface** nhỏ. Component UI không được gọi trực tiếp IndexedDB hoặc SQLite.
- CRUD và lưu trữ phải hoạt động thật, không dùng nút giả hay màn hình tĩnh cho các luồng chính.

### 2.2 Không làm trong MVP 0.1

- Đăng nhập, tài khoản, hồ sơ, admin panel, quản lý nhiều người dùng.
- Backend server, API service, cloud database, đồng bộ đám mây.
- **Không dùng Supabase.** Nó chỉ cần khi có đồng bộ đa thiết bị, và khi đó mới phải giải quyết danh tính, phân quyền và xung đột dữ liệu.
- AI, cộng tác/chia sẻ, thanh toán, analytics SDK, quảng cáo.
- Tích hợp Google Calendar/Outlook, task/event lặp lại, quản lý dự án nâng cao.
- Ứng dụng mobile native.
- Gửi nội dung người dùng ra dịch vụ ngoài hoặc ghi vào log.

---

## 3. Công nghệ

| Mảng | Lựa chọn |
|---|---|
| UI | React + TypeScript + Vite |
| Style | Tailwind CSS + shadcn/ui (hoặc hệ component nhỏ tương đương) |
| Routing | React Router |
| Lưu trữ web | IndexedDB qua Dexie |
| Lưu trữ desktop | Tauri + plugin SQLite |
| Kéo thả | dnd-kit |
| Lịch | FullCalendar React (hoặc thư viện tương đương đáng tin cậy) |
| Biểu đồ | Recharts, chỉ một vài biểu đồ nhẹ |
| Icon | Lucide |
| Test | Vitest + React Testing Library; Playwright cho luồng chính nếu kịp |

Dùng phiên bản stable, tương thích. Không thêm thư viện state management, editor hay animation nếu chưa có nhu cầu rõ ràng. Ghi lại mọi đánh đổi kỹ thuật trong README.

**Offline:** sau lần tải đầu, các luồng nhập và đọc dữ liệu phải chạy được không cần mạng. Danh sách câu hỏi Journal nằm sẵn trong app. PWA là tùy chọn, chỉ làm nếu không chậm tiến độ.

---

## 4. Kiến trúc lưu trữ

### 4.1 Repository interface

| Interface | Trách nhiệm |
|---|---|
| `TaskRepository` | list, create, update, delete, query task |
| `LabelRepository` | quản lý nhãn |
| `EventRepository` | quản lý sự kiện |
| `JournalRepository` | quản lý nhật ký theo ngày |
| `FolderRepository` | quản lý thư mục Spaces |
| `NoteRepository` | quản lý ghi chú |
| `SettingsRepository` | lưu tùy chọn cục bộ |
| `BackupService` | export, validate, import toàn bộ dữ liệu |

Hai adapter (`web-indexeddb`, `desktop-sqlite`) phải có **cùng hành vi** và cùng cách serialize timestamp. Xử lý ngày giờ và validation nằm ở code TypeScript dùng chung, không lặp trong adapter.

### 4.2 Migration

Có `schemaVersion` cho database cục bộ và cho file backup, kể cả khi bản đầu chỉ có một schema. Cần một cơ chế migration tối thiểu.

### 4.3 Phương án dự phòng

Nếu hai adapter làm chậm demo, có thể tạm dùng IndexedDB bên trong WebView của Tauri cho prototype sớm, miễn là đã test và có backup/restore. Trước khi phát hành công khai, ưu tiên chuyển sang SQLite. Phải ghi rõ trong README nếu bản demo đang dùng phương án tạm.

---

## 5. Giao diện và trải nghiệm

### 5.1 Shell ứng dụng

- **Sidebar trái:** wordmark época; điều hướng Dashboard, Todo, Kanban, Calendar, Journal, Spaces; Settings ở cuối. Sidebar thu gọn được trên màn hình hẹp.
- **Top bar:** tiêu đề trang, ô tìm kiếm (nếu làm), nút **Quick Add**.
- **Dialog/drawer** dùng chung cho tạo và sửa bản ghi, để không phải rời trang đang xem.

### 5.2 Quick Add

Mở dialog nhỏ với lựa chọn **Task** (mặc định) hoặc **Note**. Task chỉ cần tiêu đề; due date, ưu tiên, nhãn là tùy chọn. Nếu quá gấp, Quick Add chỉ tạo task trước, còn Note làm trong Spaces.

### 5.3 Quy tắc tương tác chung

- Có empty state rõ ràng kèm hành động tạo mới.
- Có thông báo thành công/lỗi cho hành động quan trọng (xóa, import backup).
- Chỉ lưu sau khi validation đạt. Lưu ngay sau khi tạo/sửa/xóa thành công.
- Xóa dữ liệu cần xác nhận hoặc undo. Ưu tiên undo cho hoàn thành task và chuyển cột Kanban.
- Không chỉ dùng màu để biểu thị trạng thái: luôn kèm chữ hoặc icon.

### 5.4 Hướng thiết kế

Bình tĩnh, cá nhân, kiểu editorial, không giống dashboard doanh nghiệp: nhiều khoảng trắng, chữ rõ, nền trung tính ấm, một màu nhấn nhẹ, bo góc vừa phải. Journal và Spaces có thể mang cảm giác "giấy"; Todo, Kanban, Calendar thiên về hiệu quả. Ưu tiên desktop, vẫn dùng được trong cửa sổ trình duyệt thường.

### 5.5 Khả năng tiếp cận

- Mọi hành động chính dùng được bằng bàn phím.
- Input có label; nút chỉ có icon phải có tên truy cập/tooltip.
- Độ tương phản đủ.
- Kéo thả luôn có cách thay thế không cần kéo (nút hoặc selector trạng thái).
- Tôn trọng `prefers-reduced-motion`.

### 5.6 i18n

Gom toàn bộ chuỗi giao diện vào file hằng số/từ điển (ví dụ `vi.ts`), để sau này thêm `en.ts` mà không phải sửa component.

---

## 6. Yêu cầu chức năng

### 6.1 Todo

**Hành động:** tạo, xem, sửa, hoàn thành/mở lại, xóa task; tạo, gán, lọc, xóa nhãn.

**Form task:** tiêu đề (bắt buộc), mô tả, trạng thái, ưu tiên, bắt đầu, kết thúc, deadline, nhãn, công tắc "Hiển thị trên lịch".

**Bộ lọc:** Tất cả, Hôm nay, Sắp tới, Quá hạn, Đã hoàn thành; lọc theo trạng thái, ưu tiên, nhãn; tìm theo tiêu đề và mô tả.
**Sắp xếp:** theo thứ tự thủ công, hạn chót, hoặc ưu tiên.

**Nhắc việc (trung thực về giới hạn):** chỉ hiển thị trạng thái trực quan (sắp tới / đến hạn hôm nay / quá hạn) và khu vực nhắc trong app khi đang mở. Không hứa push notification khi app hoặc trình duyệt đã đóng. Không đưa `reminderMinutes` vào Task.

### 6.2 Kanban

- Bốn cột ánh xạ trực tiếp vào `status`: **To do, In progress, Waiting, Done**. Không có model task riêng cho Kanban.
- Card hiển thị tiêu đề, ưu tiên, hạn chót (nếu có), nhãn. Bấm card mở cùng dialog sửa task như Todo.
- Kéo sang cột khác để đổi `status`; kéo trong cột để đổi `sortOrder`.
- Nếu lưu thất bại: báo lỗi và khôi phục vị trí cũ.
- Lọc theo nhãn và ưu tiên, dùng lại component lọc của Todo nếu được.

### 6.3 Calendar

- **Views:** Tháng, Tuần, Ngày, kèm Hôm nay / Trước / Sau và một danh sách Agenda. Nếu thiếu thời gian, tối thiểu là Tháng + Tuần + Agenda sắp tới.
- **Task** hiển thị khi có `startAt` hợp lệ và `showInCalendar = true`. Nếu thiếu `endAt`, chỉ dùng thời lượng mặc định để vẽ, **không ghi ngược** vào bản ghi.
- **Task chỉ có deadline** không được vẽ thành khối giờ; hiển thị trong danh sách agenda/deadline.
- **Event** hiển thị riêng. Task và event phải phân biệt được bằng nhãn hoặc icon, không chỉ bằng màu.
- Bấm ô trống: dialog tạo với ngày giờ điền sẵn, chọn **Task** hoặc **Event** (dùng cùng form và repository với các nơi khác).
- Kéo hoặc resize khối task: cập nhật `startAt`/`endAt` của chính task đó. Kéo hoặc resize event: cập nhật event.
- Tắt `showInCalendar`: task vẫn ở Todo và Kanban, chỉ ẩn khỏi lịch.
- Sửa/xóa event. **Không tự chuyển event thành task.**

### 6.4 Journal

- Chọn ngày bằng lịch hoặc danh sách theo thời gian; đánh dấu ngày đã có entry; nút "Viết nhật ký hôm nay".
- **Một entry cho mỗi ngày local.** Mở lại ngày đã có entry thì sửa entry đó, không tạo trùng.
- **Tâm trạng** (tùy chọn, có icon và nhãn chữ): Tuyệt vời, Tốt, Bình thường, Thấp, Tệ, Không chọn.
- **Câu hỏi gợi ý** lấy từ danh sách nội bộ, có nút "Đổi câu hỏi", không lặp lại câu vừa hiện nếu còn câu khác. Ví dụ:
  - "Hôm nay của bạn có màu gì?"
  - "Điều gì khiến bạn mỉm cười hôm nay?"
  - "Điều gì làm bạn tốn nhiều năng lượng nhất?"
  - "Hôm nay bạn biết ơn điều gì?"
  - "Có điều gì bạn muốn làm khác đi vào ngày mai?"
  - "Một điều nhỏ bạn muốn ghi nhớ là gì?"
- Trả lời câu hỏi và viết thêm nội dung dài. Hiển thị trạng thái Đang lưu / Đã lưu / Lỗi nếu có autosave.
- Xóa entry cần xác nhận. Không tạo entry trống vĩnh viễn trừ khi người dùng chủ động lưu.
- **Chuỗi ngày viết (streak):** số ngày liên tiếp có entry đã lưu và không trống, tính lùi từ hôm nay. Nếu hôm nay chưa viết, tính lùi từ hôm qua. Chỉ mở tab hoặc chọn mood mà không có nội dung thì **không** tính. UI phải giải thích quy tắc này.
- Không phân tích bằng AI, không đưa ra tuyên bố y tế hay sức khỏe tinh thần, không tự suy ra mood từ văn bản.

### 6.5 Spaces

- **Thư mục:** tạo, đổi tên, xóa; một cấp (không lồng nhau trong MVP); có mục **Chưa phân loại** (Unfiled).
- **Ghi chú:** tạo, sửa, xóa, ghim/bỏ ghim, chuyển thư mục; tiêu đề mặc định "Untitled note". Nội dung là văn bản thuần hoặc Markdown cơ bản.
- **Lưu:** autosave sau debounce 500–1000 ms với trạng thái Đang lưu/Đã lưu, hoặc nút Lưu rõ ràng kèm cảnh báo thay đổi chưa lưu. Nếu lưu lỗi, giữ nội dung trong bộ nhớ và báo lỗi, không làm mất chữ đã gõ.
- **Tìm kiếm** theo tiêu đề và nội dung; sắp xếp theo mới cập nhật, tiêu đề, hoặc ghim lên trước.
- **Xóa thư mục có ghi chú:** hộp thoại nêu rõ hệ quả; người dùng chọn Hủy hoặc Xóa thư mục cùng toàn bộ ghi chú trong đó. Không bao giờ xóa im lặng.
- Ngoài phạm vi: rich text, backlink, graph view, embed, chia sẻ.

### 6.5.1 Bố cục Spaces

Panel trái là thư mục, panel giữa là danh sách ghi chú, panel phải là editor. Trên màn hình hẹp, các panel chuyển thành trang tuần tự hoặc drawer.

### 6.6 Dashboard

Tất cả số liệu **tính từ dữ liệu thật**, không hard-code. Mỗi widget có empty state hữu ích cho người dùng mới.

| Widget | Định nghĩa |
|---|---|
| Task hôm nay | Task chưa xong có hạn chót hoặc lịch rơi vào hôm nay (giờ local) |
| Quá hạn | Task chưa `done` và `dueAt` < hiện tại; bấm mở bộ lọc Quá hạn trong Todo |
| Sắp tới | Vài event và task đã lên lịch gần nhất, sắp theo giờ bắt đầu |
| Hoàn thành tuần này | Số task có `completedAt` trong tuần hiện tại (tuần bắt đầu thứ Hai theo mặc định) |
| Biểu đồ 7 ngày | Số task hoàn thành mỗi ngày local trong 7 ngày gần nhất |
| Streak Journal | Theo quy tắc ở 6.4 |
| Hành động nhanh | Thêm task, viết nhật ký, thêm ghi chú |

Event không được tính là task đã hoàn thành. Task xong hôm nay nhưng hạn từ tuần trước thì tính vào số hoàn thành, và không còn bị đếm là quá hạn. Nếu demo cần rất nhỏ, biểu đồ có thể chỉ là một con số trước.

### 6.7 Tìm kiếm và cài đặt

- **Tìm kiếm** chạy hoàn toàn cục bộ: task (tiêu đề, mô tả), ghi chú (tiêu đề, nội dung), Journal (tối thiểu là duyệt theo ngày). Tìm kiếm toàn cục nhóm kết quả Tasks / Notes / Journal là nice-to-have.
- **Settings** (nhỏ, không phải admin panel):
  - Giao diện: Sáng, Tối, Theo hệ thống.
  - Lịch: ngày bắt đầu tuần (mặc định Thứ Hai), giờ 24h, nhớ view lịch gần nhất.
  - Dữ liệu: Export, Import, Xóa toàn bộ dữ liệu, ghi chú về lưu trữ cục bộ.
  - About: tên, phiên bản, mô tả ngắn, thông báo quyền riêng tư.

---

## 7. Mô hình dữ liệu

Đây là mô hình logic; mỗi adapter ánh xạ sang object store (IndexedDB) hoặc bảng (SQLite). Dùng ID ổn định (UUID).

### Task
`id`, `title`, `description`, `status`, `priority`, `startAt`, `endAt`, `dueAt`, `showInCalendar`, `labelIds[]`, `completedAt`, `createdAt`, `updatedAt`, `sortOrder`

- `status`: `todo | in_progress | waiting | done`
- `priority`: `none | low | medium | high` (mặc định `none`)
- Chỉ `title` do người dùng bắt buộc nhập (đã trim, không rỗng).
- `startAt`/`endAt` là khối giờ dự định; `dueAt` là deadline. Không thay thế nhau.
- Nếu có cả hai, `endAt` phải **sau** `startAt`.
- Chuyển sang `done` thì đặt `completedAt`; mở lại thì xóa.
- `showInCalendar` mặc định `true` khi task có lịch.

### Label
`id`, `name`, `color`, `createdAt`, `updatedAt`

- Tên không được trống. Màu chỉ hỗ trợ nhận diện, không phải cách duy nhất.
- Đổi tên thì hiển thị mới ở mọi nơi. Xóa nhãn thì gỡ liên kết khỏi task nhưng **không xóa task**.

### Event
`id`, `title`, `description`, `startAt`, `endAt`, `allDay`, `reminderMinutes`, `color`, `createdAt`, `updatedAt`

- Bắt buộc `title` và `startAt`; `endAt` tùy chọn, nếu có phải sau `startAt`.
- Không có `status`. Tạo event không được tạo task ngầm.

### JournalEntry
`id`, `entryDate`, `title`, `content`, `mood`, `promptId`, `createdAt`, `updatedAt`

- `entryDate` là chuỗi ngày local `YYYY-MM-DD`, **không** dùng timestamp UTC để tránh lệch ngày.
- `mood`: `great | good | okay | low | rough | none`. `title` tùy chọn.
- Ràng buộc: duy nhất một entry cho mỗi `entryDate`.

### Folder
`id`, `name`, `sortOrder`, `createdAt`, `updatedAt` (một cấp, không có `parentId` trong MVP)

### Note
`id`, `folderId` (null = Chưa phân loại), `title`, `content`, `isPinned`, `createdAt`, `updatedAt`

### Settings
Theme, ngày bắt đầu tuần, kiểu hiển thị giờ, view lịch gần nhất, `schemaVersion`. Lưu cục bộ theo từng bản cài đặt.

---

## 8. Sao lưu, khôi phục và dữ liệu

### 8.1 Export

Settings → Dữ liệu → **Export backup**. File JSON chứa toàn bộ task, nhãn, event, journal, thư mục, ghi chú và cài đặt liên quan, cùng ID và quan hệ. Tên file dạng `epoca-backup-YYYY-MM-DD.json`. Web tải qua trình duyệt; desktop dùng hộp thoại lưu file nếu tích hợp Tauri hỗ trợ.

Cấu trúc gợi ý:

```json
{
  "app": "epoca",
  "backupVersion": 1,
  "exportedAt": "2026-10-18T09:30:00.000Z",
  "data": {
    "tasks": [],
    "labels": [],
    "events": [],
    "journalEntries": [],
    "folders": [],
    "notes": [],
    "settings": {}
  }
}
```

### 8.2 Import

- **Validate trước khi thay đổi bất cứ gì**: loại file, `app`, `backupVersion` được hỗ trợ, cấu trúc bắt buộc, tính toàn vẹn quan hệ (`labelIds`, `folderId`).
- File sai hoặc không hỗ trợ: báo lỗi rõ ràng và **không đụng vào dữ liệu hiện tại**.
- MVP chỉ hỗ trợ chế độ **Thay thế dữ liệu cục bộ**, kèm cảnh báo xác nhận mạnh. Merge là ngoài phạm vi trừ khi làm được an toàn.
- Nên tạo snapshot rollback tạm trước khi thay thế, nếu khả thi.
- Sau khi import thành công, làm mới mọi view.

### 8.3 Chuyển dữ liệu giữa web và PC

Export ở nơi nguồn, chuyển file, import ở nơi đích. Đây là sao chép/khôi phục thủ công, **không phải đồng bộ hai chiều**.

### 8.4 Xóa toàn bộ dữ liệu

Hành động tường minh ở Settings → Dữ liệu. Hộp xác nhận nêu rõ các loại dữ liệu sẽ mất và khuyên export trước. Chỉ ảnh hưởng bản cài đặt hiện tại.

### 8.5 Thông báo quyền riêng tư

Hiển thị trong Settings/About:

> "época MVP lưu nội dung của bạn cục bộ trên thiết bị/trình duyệt này. Không có tài khoản hay đồng bộ đám mây. Xóa dữ liệu trình duyệt/ứng dụng có thể làm mất nội dung. Hãy export backup thường xuyên."

Không tuyên bố dữ liệu được mã hóa trừ khi thực sự có mã hóa và đã kiểm thử. Xóa dữ liệu trình duyệt, gỡ cài đặt hoặc reset app đều có thể làm mất dữ liệu, nên sao lưu phải là tính năng hiển thị rõ, không phải công cụ ẩn.

---

## 9. Quy tắc nghiệp vụ và trường hợp biên

1. **Một nguồn sự thật cho task:** mọi view tham chiếu cùng Task ID.
2. **Nhất quán hoàn thành:** `status = done` tương ứng `completedAt` khác null; mở lại thì xóa.
3. **Ngày giờ theo local:** dùng một bộ tiện ích ngày thống nhất. Thời điểm có giờ lưu dạng ISO timestamp; ngày Journal lưu dạng chuỗi ngày local. Không để ngày thuần bị lệch sang hôm trước/sau do chuyển đổi UTC.
4. **Lịch không hợp lệ bị từ chối:** kết thúc không được sớm hơn hoặc bằng bắt đầu.
5. **Đổi múi giờ:** hiển thị theo múi giờ local hiện tại; lịch lặp liên múi giờ ngoài phạm vi.
6. **Xóa có chủ đích:** xóa task gỡ khỏi mọi view; xóa nhãn không xóa task; xóa thư mục phải giải thích hệ quả với ghi chú.
7. **Autosave phải nhìn thấy được:** hiện Đang lưu / Đã lưu / Lỗi.
8. **Không hứa nhắc việc giả:** badge hạn chót không phải thông báo thật.
9. **Backup giữ ID và quan hệ:** nhãn, thư mục, ghi chú vẫn liên kết đúng sau khôi phục.
10. **Web và desktop tách biệt:** cùng phần mềm không có nghĩa là chung dữ liệu.
11. **Không phụ thuộc dịch vụ ngoài** cho nội dung cốt lõi.

---

## 10. Cấu trúc mã nguồn gợi ý

```text
src/
  app/                 # App shell, router, providers
  components/          # layout/, shared/, ui/
  features/
    dashboard/  tasks/  kanban/  calendar/  journal/  spaces/  settings/
  data/
    models.ts          # kiểu dữ liệu dùng chung
    repositories/      # interface + logic dùng chung
    adapters/
      web-indexeddb/   # Dexie
      desktop-sqlite/  # Tauri SQLite
    migrations/
    backup/
  lib/                 # dates.ts, validation.ts, ids.ts, i18n/constants
  hooks/
  styles/
  test/
  main.tsx
src-tauri/
  tauri.conf.json
```

Đây chỉ là gợi ý; không tạo abstraction rỗng. Giữ adapter tách khỏi UI và giữ business rules dùng chung.

---

## 11. Lộ trình triển khai

Giữ app chạy được sau mỗi milestone. Làm cho luồng dữ liệu đầu-cuối đáng tin cậy **trước khi** trau chuốt giao diện.

| Milestone | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| **1. Nền tảng** | Vite + React + TS, shell, điều hướng, model và validation dùng chung, repository, adapter web, khởi tạo/phiên bản database | Lưu và đọc lại được một bản ghi thử, sau khi refresh |
| **2. Todo + Labels** | Danh sách, bộ lọc, dialog tạo/sửa, ưu tiên, lịch, deadline, nhãn, hoàn thành, xóa, tìm kiếm | CRUD task bền vững qua refresh |
| **3. Kanban + Calendar** | Cột và kéo thả; Tháng/Tuần/(Ngày)/Agenda; tạo, sửa, dời task và event từ lịch | Không có task trùng lặp; trạng thái nhất quán qua cả ba view |
| **4. Journal + Spaces** | Mood, câu hỏi, entry theo ngày, streak; thư mục, ghi chú, autosave, tìm kiếm | Nội dung còn nguyên sau khi mở lại app |
| **5. Dashboard + Backup** | Widget từ dữ liệu thật; export/import/xóa dữ liệu; empty state, lỗi, bàn phím | Số liệu đổi theo dữ liệu; backup khứ hồi đúng |
| **6. Desktop + Kiểm thử** | Tauri, adapter SQLite, bộ cài Windows; test luồng chính; README | Dữ liệu desktop còn sau khi thoát/mở lại |

Chỉ dùng dữ liệu mẫu qua hành động có nhãn rõ "Tải dữ liệu mẫu"; không đưa số liệu giả vào màn hình production.

---

## 12. Tiêu chí nghiệm thu demo

- [ ] `npm install` và lệnh dev được ghi trong README khởi động được web app.
- [ ] Dữ liệu web còn sau khi refresh và khởi động lại trình duyệt.
- [ ] App desktop build và chạy theo hướng dẫn; dữ liệu còn sau khi đóng/mở lại.
- [ ] Web và desktop lưu riêng, điều này được giải thích trong UI và README.
- [ ] Tạo task ở Todo thì xuất hiện ở Kanban; kéo sang Done thì Todo cập nhật.
- [ ] Task đã lên lịch hiện trên Calendar; đổi giờ từ Calendar cập nhật đúng task đó ở Todo.
- [ ] Tạo event không tạo task.
- [ ] Journal (mood, câu hỏi, nội dung), thư mục và ghi chú đều được lưu cục bộ.
- [ ] Dashboard thay đổi theo dữ liệu thật.
- [ ] Export/import khứ hồi giữ nguyên task, nhãn, event, journal, thư mục, ghi chú và mọi quan hệ.
- [ ] Không cần login, server API, Supabase, admin, telemetry hay dịch vụ ngoài khi dùng bình thường.
- [ ] Nút và form chính hoạt động; có validation, empty/error state; không có dữ liệu giả trong màn hình production.

---

## 13. Danh sách QA thủ công

**Web**
- [ ] Tạo/sửa/xóa task rồi refresh.
- [ ] Kéo task giữa các cột Kanban rồi refresh.
- [ ] Lên lịch task, dời trên Calendar, kiểm tra giờ ở Todo.
- [ ] Tạo và sửa event độc lập.
- [ ] Tạo/sửa/xóa entry Journal; mood và câu hỏi còn nguyên.
- [ ] Tạo thư mục và ghi chú; sửa, ghim, chuyển, tìm kiếm.
- [ ] Dashboard đổi khi hoàn thành task.
- [ ] Export rồi import vào profile sạch, kiểm tra quan hệ.
- [ ] Thử offline sau khi app đã tải.
- [ ] UI cảnh báo dữ liệu trình duyệt có thể mất khi xóa site data.

**Desktop**
- [ ] Cài và mở không cần môi trường dev.
- [ ] Tạo/sửa/xóa dữ liệu, thoát hẳn rồi mở lại.
- [ ] Dữ liệu desktop không bị tự động gộp với dữ liệu trình duyệt.
- [ ] Export từ desktop → import vào web, và ngược lại.
- [ ] File backup không hợp lệ; luồng hủy.
- [ ] Cập nhật/cài lại không làm mất dữ liệu ngoài ý muốn (hoặc ghi rõ giới hạn nền tảng).

**Nhất quán giữa các view**
- [ ] Task Todo xuất hiện ở Kanban; đổi trạng thái ở Kanban cập nhật Todo và Dashboard.
- [ ] Task chỉ hiện trên Calendar khi đủ điều kiện và được bật; ẩn khỏi lịch không xóa task.
- [ ] Xóa task gỡ khỏi mọi view; event không bị đếm là task.

---

## 14. Rủi ro và việc hoãn lại

| Rủi ro | Giảm thiểu |
|---|---|
| Người dùng tưởng web và PC dùng chung dữ liệu | Giải thích trong onboarding/About; Export/Import dễ tìm; không gọi hai bản sao cục bộ là "đồng bộ" |
| Mất dữ liệu | Backup/restore nhìn thấy được; xác nhận trước khi thay thế/xóa; test lưu trữ và migration |
| Adapter SQLite phức tạp | Giữ business rules và UI độc lập với adapter; xem phương án tạm ở 4.3 |
| Hiểu nhầm về nhắc việc | Chỉ nhắc trong app khi mở; không hứa thông báo khi đóng app |

**Hoãn sang sau MVP:** đồng bộ đám mây và mô hình tài khoản; PWA hoàn thiện; thông báo nền tự động; task/event lặp; thư mục lồng nhau và editor phong phú; tìm kiếm toàn cục đầy đủ; habit, focus timer, weekly review, analytics nâng cao; build Mac/Linux.

---

## 15. Quyết định khi hai file gốc khác nhau

| Chủ đề | Quyết định trong tài liệu này |
|---|---|
| Journal có `title` | Có, tùy chọn (theo spec) |
| Journal lưu câu hỏi | Dùng `promptId` (danh sách nội bộ cố định) |
| Note có `isPinned` | Có (theo spec); là một phần của backup |
| Thư mục lồng nhau | Không; một cấp |
| Merge khi import | Không; chỉ Thay thế |
| Calendar views | Tháng, Tuần, Ngày + Agenda; tối thiểu Tháng + Tuần + Agenda |
| Quick Add | Task hoặc Note; rút gọn thành chỉ Task nếu gấp |
| Streak khi hôm nay chưa viết | Tính lùi từ hôm qua |
| `reminderMinutes` | Chỉ có ở Event, không có ở Task |

---

## 16. Hướng dẫn cho agent triển khai

1. **Kiểm tra repo trước** khi sửa file. Nếu repo trống, dựng khung dự án theo công nghệ ở mục 3.
2. Làm theo milestone nhỏ, kiểm thử được. Ưu tiên code đơn giản, tường minh hơn là trừu tượng sớm.
3. Viết unit test cho các quy tắc quan trọng: validation task/event (thứ tự giờ), `completedAt`, xóa nhãn, quy tắc streak, định nghĩa tuần và quá hạn, validate và import backup.
4. Không tuyên bố tính năng đã hoàn thành nếu luồng chính chưa được cài đặt và kiểm thử.
5. Không thêm: đăng nhập, backend, Supabase, AI, thanh toán, tích hợp lịch ngoài, telemetry.

**Trước khi kết thúc, báo cáo:**
1. Những gì đã triển khai.
2. Cách chạy web app cục bộ.
3. Cách build và chạy app desktop Windows.
4. Mỗi build lưu dữ liệu ở đâu.
5. Những gì chưa xong hoặc cố ý ngoài phạm vi.
6. Các test đã chạy và kết quả.

Cần có `README.md` dễ theo dõi với: yêu cầu môi trường, lệnh chạy dev, lệnh build web và desktop, vị trí lưu dữ liệu, giải thích web và desktop tách biệt, cách backup/chuyển dữ liệu, và các đánh đổi kỹ thuật đã chọn.

---

## 17. Thỏa thuận cuối

época MVP 0.1 là một **không gian làm việc cá nhân local-first** với sáu khu vực: Dashboard, Todo, Kanban, Calendar, Journal và Spaces. Có bản web và bản desktop tải về được, mỗi bản lưu dữ liệu cục bộ riêng, chuyển dữ liệu thủ công bằng sao lưu JSON.

Bản demo **không có** đăng nhập, admin, server API, Supabase, sao lưu đám mây tự động hay đồng bộ đa thiết bị. Đây là lựa chọn có chủ đích để giữ kiến trúc nhỏ và đúng với yêu cầu dữ liệu nằm trên trình duyệt hoặc trên máy.

Yêu cầu kỹ thuật quan trọng nhất là **tính nhất quán**: Todo, Kanban và Calendar cùng thao tác trên một bản ghi task, còn Event luôn là bản ghi riêng. Sao lưu/khôi phục và thông báo rõ ràng về lưu trữ cục bộ giúp người dùng không bị thiệt vì giới hạn của mô hình local-only.
