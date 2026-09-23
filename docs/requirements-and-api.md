# Yêu cầu chức năng và danh sách API

Bản nháp tuần 1. Sau khi chốt, coi đây là "hợp đồng" giữa frontend và backend. Đổi API sau tuần 3 phải sửa cả hai phía.

## 1. Chức năng theo vai trò

**Khách (chưa đăng nhập)**
- Xem trang chủ, danh sách sản phẩm, chi tiết sản phẩm.
- Tìm kiếm theo từ khóa; lọc theo danh mục, thương hiệu, khoảng giá; sắp xếp; phân trang.
- Đăng ký, đăng nhập.

**Người dùng (đã đăng nhập)**
- Quản lý giỏ hàng: thêm, sửa số lượng, xóa.
- Đặt hàng: nhập thông tin giao hàng, chọn COD hoặc VNPay.
- Thanh toán VNPay.
- Xem lịch sử đơn và chi tiết đơn; hủy đơn khi còn chờ xử lý.
- Xem và sửa thông tin cá nhân.
- Chat với admin.

**Admin**
- Quản lý sản phẩm.
- Quản lý đơn hàng: xem, lọc theo trạng thái, đổi trạng thái.
- Quản lý người dùng: tìm kiếm, khóa/mở khóa, đổi vai trò.
- Trả lời chat của người dùng.
- Xem thống kê: doanh thu theo ngày/tháng, top sản phẩm bán chạy, đơn theo trạng thái, người dùng mới.

## 2. Quy ước chung

- Tiền tố đường dẫn: `/api`. Dữ liệu vào và ra dạng JSON (trừ upload ảnh dùng `multipart/form-data`).
- Xác thực: header `Authorization: Bearer <accessToken>`.
- Phân trang: query `page` (từ 1) và `limit`. Phản hồi dạng `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 135 } }`.
- Lỗi: dùng định dạng mặc định của NestJS (`statusCode`, `message`, `error`).
- Tiền tệ: VND, số nguyên.
- Quyền: **Public** (ai cũng gọi được), **User** (đã đăng nhập), **Admin**.

**Chuyển trạng thái đơn hàng (bản nháp, chốt ở tuần 4)**
- `PENDING` → `PAID`: chỉ hệ thống thực hiện, khi nhận IPN hợp lệ từ VNPay.
- `PENDING` → `SHIPPING`: admin xác nhận (đơn COD).
- `PAID` → `SHIPPING` → `COMPLETED`: admin cập nhật.
- `PENDING` → `CANCELLED`: người dùng hoặc admin hủy, hoàn lại tồn kho.

## 3. Danh sách API

### Xác thực và người dùng

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Public | Đăng ký tài khoản |
| POST | `/auth/login` | Public | Đăng nhập, trả access token và refresh token |
| POST | `/auth/refresh` | Public | Đổi refresh token lấy cặp token mới |
| POST | `/auth/logout` | User | Thu hồi refresh token |
| GET | `/users/me` | User | Xem thông tin cá nhân |
| PATCH | `/users/me` | User | Sửa thông tin cá nhân |
| GET | `/admin/users` | Admin | Danh sách người dùng (tìm kiếm, phân trang) |
| PATCH | `/admin/users/:id/status` | Admin | Khóa hoặc mở khóa tài khoản |
| PATCH | `/admin/users/:id/role` | Admin | Đổi vai trò |

### Sản phẩm (khách xem)

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `/categories` | Public | Danh sách danh mục |
| GET | `/brands` | Public | Danh sách thương hiệu |
| GET | `/products` | Public | Danh sách sản phẩm. Query: `q`, `categoryId`, `brandId`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`. `sort` nhận `newest` (mặc định), `price_asc`, `price_desc`. Chỉ trả sản phẩm đang bán, mỗi sản phẩm kèm ảnh đầu tiên |
| GET | `/products/:id` | Public | Chi tiết sản phẩm kèm ảnh và thông số |

### Sản phẩm (admin quản lý)

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `/admin/products` | Admin | Danh sách kể cả sản phẩm đang ẩn |
| POST | `/admin/products` | Admin | Tạo sản phẩm |
| PATCH | `/admin/products/:id` | Admin | Sửa sản phẩm (kể cả ẩn/hiện, chỉnh tồn kho) |
| DELETE | `/admin/products/:id` | Admin | Ẩn sản phẩm (đặt `isActive = false`), không xóa hẳn |
| POST | `/admin/products/:id/images` | Admin | Upload ảnh |
| DELETE | `/admin/products/:id/images/:imageId` | Admin | Xóa ảnh |
| POST | `/admin/categories` | Admin | Tạo danh mục |
| PATCH | `/admin/categories/:id` | Admin | Sửa danh mục |
| DELETE | `/admin/categories/:id` | Admin | Xóa danh mục (chặn nếu còn sản phẩm) |
| POST | `/admin/brands` | Admin | Tạo thương hiệu |
| PATCH | `/admin/brands/:id` | Admin | Sửa thương hiệu |
| DELETE | `/admin/brands/:id` | Admin | Xóa thương hiệu (chặn nếu còn sản phẩm) |

### Giỏ hàng

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `/cart` | User | Xem giỏ hàng. Mỗi dòng kèm tên, giá hiện tại, ảnh đầu tiên và tồn kho của sản phẩm |
| POST | `/cart/items` | User | Thêm sản phẩm. Body: `productId`, `quantity` |
| PATCH | `/cart/items/:itemId` | User | Đổi số lượng |
| DELETE | `/cart/items/:itemId` | User | Xóa một sản phẩm khỏi giỏ |
| DELETE | `/cart` | User | Xóa toàn bộ giỏ |

### Đơn hàng và thanh toán

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| POST | `/orders` | User | Tạo đơn từ giỏ. Body: `shippingName`, `shippingPhone`, `shippingAddress`, `paymentMethod`, `note` |
| GET | `/orders` | User | Lịch sử đơn của tôi |
| GET | `/orders/:id` | User | Chi tiết đơn của tôi |
| POST | `/orders/:id/cancel` | User | Hủy đơn khi còn `PENDING` |
| POST | `/payments/vnpay/create` | User | Tạo URL thanh toán VNPay. Body: `orderId` |
| GET | `/payments/vnpay/return` | Public | Trình duyệt được VNPay chuyển về. Chỉ hiển thị kết quả, không cập nhật đơn |
| GET | `/payments/vnpay/ipn` | Public | VNPay gọi vào để báo kết quả. Kiểm tra chữ ký và số tiền rồi mới cập nhật đơn. Phương thức HTTP theo tài liệu VNPay, cần xác nhận lại ở tuần 5 |
| GET | `/admin/orders` | Admin | Danh sách đơn (lọc theo trạng thái, phân trang) |
| GET | `/admin/orders/:id` | Admin | Chi tiết đơn, kèm thông tin người mua (họ tên, email, số điện thoại) |
| PATCH | `/admin/orders/:id/status` | Admin | Đổi trạng thái đơn |

### Chat

REST (lấy lịch sử):

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `/chat/messages` | User | Lịch sử tin nhắn của tôi với admin |
| GET | `/admin/chat/conversations` | Admin | Danh sách hội thoại, sắp theo tin mới nhất, kèm tên người dùng và tin nhắn cuối |
| GET | `/admin/chat/conversations/:id/messages` | Admin | Lịch sử một hội thoại |

Socket.IO (namespace `/chat`, gửi access token khi kết nối):

| Hướng | Sự kiện | Nội dung |
|---|---|---|
| Client → Server | `message:send` | `{ conversationId?, content }`. Người dùng không cần `conversationId`, admin phải có |
| Server → Client | `message:new` | Tin nhắn mới (`id`, `conversationId`, `senderId`, `content`, `createdAt`) |

### Thống kê (admin)

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `/admin/stats/summary` | Admin | Tổng doanh thu, số đơn, số người dùng, người dùng mới |
| GET | `/admin/stats/revenue` | Admin | Doanh thu theo thời gian. Query: `from`, `to`, `groupBy=day\|month`. Không có `from` và `to` thì lấy 30 ngày gần nhất |
| GET | `/admin/stats/top-products` | Admin | Sản phẩm bán chạy. Query: `limit` |
| GET | `/admin/stats/orders-by-status` | Admin | Số đơn theo từng trạng thái |