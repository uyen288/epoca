# AGENTS.md - época
## Stack
- React 18, TypeScript 5.x, Vite, TanStack Query, Zustand
- Tailwind CSS + shadcn/ui
## Cấu trúc thư mục
src/
├── app/
│ ├── providers.tsx
│ └── App.tsx
├── pages/
├── features/
│ └── (feature-name)/
│ ├── components/
│ ├── hooks/
│ ├── store.ts
│ └── types.ts
├── components/
├── hooks/
├── lib/
├── services/
├── types/
└── styles/

- Code thuộc một nghiệp vụ cụ thể đặt trong `features/<feature-name>/`.
- Component dùng chung nhiều feature đặt trong `components/`.
- Hook dùng chung đặt trong `hooks/`.
- Logic gọi API đặt trong `services/` hoặc service riêng của feature.
- Type dùng chung đặt trong `types/`; type chỉ thuộc một feature đặt cạnh feature đó.
- Không tạo file hoặc thư mục mới nếu logic đã có vị trí phù hợp.
## Quy ước
- Không dùng `any` — luôn TypeScript chặt.
- Ưu tiên `unknown` khi chưa biết kiểu dữ liệu và phải narrowing trước khi sử dụng.
- Component export dạng named export hoặc default, ghi rõ và nhất quán với convention của file/module.
- Props phải có type/interface rõ ràng.
- Không dùng `React.FC` nếu không có lý do cụ thể.
- Event handler phải có type chính xác, không dùng `Function`.
- Error nghiệp vụ/API dùng `AppError`; không `console.error`.
- Không nuốt lỗi bằng `catch {}` nếu không có xử lý rõ ràng.
- Không dùng magic number/string nếu có thể đặt thành constant có tên.
- Tên biến, function và component phải mô tả đúng ý nghĩa; tránh tên chung chung như `data`, `item`, `handle`, `doSomething` khi có thể đặt tên cụ thể hơn.
- Commit message theo Conventional Commits:
    - `feat(tickets): add remove item`
    - `fix(auth): handle expired session`
    - `refactor(users): extract user table`
    - `test(tickets): cover remove item`
    - Không dùng message mơ hồ như `fix stuff`, `update`, `changes`.

## React

- Component phải tập trung vào render và interaction; đưa business logic phức tạp ra hook/service.
- Không lạm dụng `useEffect`. Ưu tiên derived state, event handler hoặc TanStack Query khi phù hợp.
- Không dùng `useEffect` để đồng bộ state có thể tính trực tiếp từ props/state khác.
- Không lưu vào state dữ liệu có thể derive trực tiếp.
- Không mutate props, state hoặc object từ bên ngoài.
- Với list, `key` phải ổn định và duy nhất; không dùng array index nếu item có identity riêng.
- Tránh component quá lớn. Khi một component chứa nhiều responsibility hoặc khó đọc, tách thành component/hook nhỏ hơn.
- Không tạo abstraction chỉ để “cho đẹp”. Chỉ tách khi có boundary hoặc logic thực sự được tái sử dụng.

## Data fetching

- Dùng TanStack Query cho server state.
- Không dùng Zustand để thay thế TanStack Query cho dữ liệu lấy từ API.
- Không tự quản lý `loading/error/data` bằng nhiều `useState` nếu dữ liệu thuộc server state.
- Query key phải ổn định và chứa đầy đủ tham số ảnh hưởng đến dữ liệu.
- Mutation phải invalidate/update đúng query liên quan sau khi thành công.
- Không gọi API trực tiếp trong component.
- API client/service phải nằm ngoài UI layer.
- Không hardcode API URL — lấy base URL từ `.env`.
- Không expose secret vào frontend. Chỉ dùng biến môi trường được phép public theo convention của Vite.
- Khi thêm endpoint mới, kiểm tra response/error shape thay vì giả định backend luôn trả dữ liệu đúng.

## State management

- Zustand chỉ dùng cho client state hoặc state xuyên nhiều component khi thực sự cần.
- Ưu tiên local state cho state chỉ phục vụ một component.
- Không đưa mọi state vào Zustand.
- Store không được chứa logic gọi API nếu logic đó thuộc server state và có thể xử lý bằng TanStack Query.
- Selector Zustand phải đủ hẹp để tránh re-render không cần thiết.
- Không mutate state trực tiếp.

## API và Error handling

- API layer phải chuẩn hóa lỗi về `AppError` hoặc error type đã được project định nghĩa.
- Không để UI phụ thuộc trực tiếp vào cấu trúc response thô của HTTP client nếu có thể tránh.
- Không kiểm tra lỗi bằng string message nếu có error code/type ổn định.
- Không hiển thị stack trace, internal error hoặc thông tin nhạy cảm cho user.
- Error message hiển thị cho user phải thân thiện và có ngữ cảnh.
- Nếu lỗi cần bubble lên error boundary hoặc mutation/query handler thì phải throw, không âm thầm return `null`.
- Không `console.log()` trong production code.

## Forms và validation

- Validation phải được thực hiện ở boundary phù hợp, không chỉ dựa vào UI.
- Không tin dữ liệu từ input người dùng hoặc API là đúng kiểu chỉ vì TypeScript đã khai báo type.
- TypeScript không thay thế runtime validation cho dữ liệu từ network.
- Với payload quan trọng, validate/parse response ở API boundary nếu project đã có schema validation.
- Disable submit trong trạng thái đang submit khi việc submit lặp lại có thể gây side effect.
- Hiển thị validation error gần field tương ứng.
- Không reset form ngoài ý muốn sau mutation.

## UI và accessibility

- Ưu tiên component có sẵn của shadcn/ui trước khi tự tạo component tương đương.
- Dùng semantic HTML khi có thể.
- Button phải dùng `<button>`, link điều hướng phải dùng `<a>` hoặc router link phù hợp.
- Form control phải có label hoặc accessible name.
- Không dùng màu sắc làm cách duy nhất để truyền tải trạng thái.
- Loading, empty và error state phải được xử lý rõ ràng.
- Modal/dialog phải hỗ trợ keyboard interaction và focus management.
- Không disable control chỉ để che một lỗi logic.
- Responsive layout phải được kiểm tra ở mobile và desktop.

## Tailwind CSS

- Ưu tiên utility class và design token có sẵn.
- Không lặp lại chuỗi class dài nếu có thể dùng component hoặc abstraction hợp lý.
- Không dùng inline style nếu Tailwind/CSS hiện tại đã đáp ứng được.
- Không thêm màu, spacing hoặc breakpoint tùy ý nếu design system đã có token tương ứng.
- Khi cần class động, tránh ghép class bằng string dễ gây lỗi build; dùng pattern mà Tailwind có thể detect được hoặc utility phù hợp.

## Import

- Không import bằng `../../../`.
- Ưu tiên alias đã cấu hình, ví dụ:

```
import { Button } from '@/components/ui/button';
```

- Import theo dependency direction hợp lý: UI không nên tạo circular dependency với feature/service.
- Không import từ internal file sâu của một module nếu module đó đã có public entry point.
- Xóa unused import và dead code.

## Naming

- Component: `PascalCase`
- Hook: `useSomething`
- Function/variable: `camelCase`
- Constant: `UPPER_SNAKE_CASE` khi là constant cấp module và thực sự cần biểu thị constant.
- Type/interface: `PascalCase`
- Boolean: ưu tiên prefix `is`, `has`, `can`, `should`.
- Query hook: `useSomethingQuery`
- Mutation hook: `useSomethingMutation`
- File component nên phản ánh tên component.
- Không đặt tên một file theo nhiều convention khác nhau.

## Cấm

- Không dùng Redux Toolkit.
- Không hardcode API URL.
- Không import từ `../../../`.
- Không có `console.log()` trong production.
- Không dùng `any`.
- Không bypass TypeScript bằng `@ts-ignore` hoặc `@ts-nocheck`.
- Không dùng `@ts-expect-error` nếu không có comment giải thích lý do và không có cách type-safe hợp lý hơn.
- Không commit secret, token, API key hoặc file `.env` chứa secret.
- Không duplicate API client hoặc auth logic ở nhiều nơi.
- Không copy-paste business logic giữa các feature nếu có thể tái sử dụng bằng abstraction rõ ràng.

## Testing

- Test behavior, không test implementation detail khi không cần thiết.
- Unit test cho business logic thuần và utility quan trọng.
- Component test cho interaction quan trọng.
- Test loading, success, empty và error state đối với UI có server state.
- Test mutation quan trọng, đặc biệt các thao tác tạo/sửa/xóa.
- Không giảm hoặc xóa test chỉ để làm CI pass.
- Khi sửa bug, ưu tiên thêm regression test nếu bug có thể tái diễn.

## Performance

- Không tối ưu sớm nếu chưa có vấn đề thực tế.
- Tránh unnecessary re-render trước khi dùng `memo`, `useMemo`, `useCallback`.
- Không fetch dữ liệu không cần thiết.
- Với list lớn, cân nhắc pagination hoặc virtualization thay vì render toàn bộ.
- Không dùng memoization để che giấu state architecture không hợp lý.
- Image phải có kích thước/strategy phù hợp và không tải asset lớn hơn nhu cầu.

## Security

- Không render HTML từ user input bằng `dangerouslySetInnerHTML` nếu chưa sanitize.
- Không lưu access token/secret vào nơi không phù hợp.
- Không đưa thông tin nhạy cảm vào URL, query key, log hoặc error message.
- Không tin tưởng dữ liệu từ client; authorization thực tế phải được backend đảm bảo.
- Không commit credentials hoặc secret vào Git.

## Git

- Mỗi commit nên có một mục đích rõ ràng.
- Không trộn refactor lớn với feature/bugfix nếu không cần thiết.
- Không commit generated files hoặc build artifacts nếu repository không yêu cầu.
- Trước khi commit, chạy lint/typecheck/test phù hợp với thay đổi.
- Không sửa lịch sử Git của người khác nếu không được yêu cầu.
- Không dùng force push trừ khi người dùng yêu cầu rõ ràng.

## Khi sửa code

Trước khi thay đổi:

1. Đọc code liên quan và xác định dependency.
2. Tìm implementation hiện tại trước khi tạo abstraction mới.
3. Kiểm tra type, API contract và cách project đang xử lý error.
4. Xác định phạm vi thay đổi nhỏ nhất để giải quyết yêu cầu.
5. Không tự ý refactor code không liên quan.

Sau khi thay đổi:

1. Chạy TypeScript check.
2. Chạy lint.
3. Chạy test liên quan.
4. Kiểm tra import và dead code.
5. Kiểm tra loading/error/empty state nếu thay đổi UI hoặc API.
6. Review diff để chắc chắn không có thay đổi ngoài phạm vi yêu cầu.

## Nguyên tắc ưu tiên

Khi các yêu cầu mâu thuẫn nhau, ưu tiên theo thứ tự:

1. Correctness và security.
2. Type safety.
3. Existing project conventions.
4. Simplicity và maintainability.
5. Performance.
6. Developer convenience.

Không thêm abstraction, dependency hoặc pattern mới chỉ vì “có thể hữu ích”. Mọi thay đổi phải có lý do rõ ràng và phù hợp với kiến trúc hiện tại.