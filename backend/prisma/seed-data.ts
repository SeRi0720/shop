// Dữ liệu mẫu cho `npx prisma db seed`. Giá VND (số nguyên). Đây là dữ liệu minh họa,
// thông số không nhất thiết khớp 100% với sản phẩm thật ngoài thị trường.
// `specs` là object phẳng, giá trị là chuỗi (quyết định 11 của kế hoạch tuần 3).

export type SeedProduct = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string; // khớp tên trong `categories`
  brand: string; // khớp tên trong `brands`
  specs: Record<string, string>;
  isActive?: boolean; // mặc định true; false để thử chức năng ẩn
};

export const categories = [
  'Laptop',
  'Điện thoại',
  'Máy tính bảng',
  'Âm thanh',
  'Phụ kiện',
];

export const brands = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Dell',
  'Asus',
  'Lenovo',
  'Sony',
  'Logitech',
  'Anker',
  'Keychron',
];

export const products: SeedProduct[] = [
  // ---- Laptop ----
  {
    name: 'MacBook Air 13 inch M3 16GB/512GB',
    description:
      'Laptop mỏng nhẹ, pin lâu, phù hợp học tập và làm việc di động.',
    price: 32990000,
    stock: 15,
    category: 'Laptop',
    brand: 'Apple',
    specs: {
      Chip: 'Apple M3',
      RAM: '16 GB',
      'Ổ cứng': '512 GB SSD',
      'Màn hình': '13.6 inch Liquid Retina',
      Pin: 'Đến 18 giờ',
    },
  },
  {
    name: 'MacBook Pro 14 inch M4 Pro 24GB/512GB',
    description: 'Laptop hiệu năng cao cho lập trình, đồ họa và dựng video.',
    price: 52990000,
    stock: 6,
    category: 'Laptop',
    brand: 'Apple',
    specs: {
      Chip: 'Apple M4 Pro',
      RAM: '24 GB',
      'Ổ cứng': '512 GB SSD',
      'Màn hình': '14.2 inch Liquid Retina XDR',
      Pin: 'Đến 22 giờ',
    },
  },
  {
    name: 'Dell XPS 13 Plus 32GB/1TB',
    description: 'Laptop cao cấp thiết kế liền khối, màn hình viền mỏng.',
    price: 45990000,
    stock: 8,
    category: 'Laptop',
    brand: 'Dell',
    specs: {
      CPU: 'Intel Core Ultra 7',
      RAM: '32 GB',
      'Ổ cứng': '1 TB SSD',
      'Màn hình': '13.4 inch OLED 3.5K',
      'Trọng lượng': '1,26 kg',
    },
  },
  {
    name: 'Asus Zenbook 14 OLED UX3405 Ultra 7',
    description: 'Ultrabook màn hình OLED, nhẹ dưới 1,3 kg.',
    price: 28990000,
    stock: 12,
    category: 'Laptop',
    brand: 'Asus',
    specs: {
      CPU: 'Intel Core Ultra 7 155H',
      RAM: '16 GB',
      'Ổ cứng': '1 TB SSD',
      'Màn hình': '14 inch OLED 3K 120Hz',
      'Trọng lượng': '1,2 kg',
    },
  },
  {
    name: 'Asus ROG Strix G16 RTX 4060',
    description: 'Laptop gaming hiệu năng mạnh, tản nhiệt tốt.',
    price: 34990000,
    stock: 7,
    category: 'Laptop',
    brand: 'Asus',
    specs: {
      CPU: 'Intel Core i7-13650HX',
      GPU: 'RTX 4060 8GB',
      RAM: '16 GB',
      'Ổ cứng': '1 TB SSD',
      'Màn hình': '16 inch QHD+ 240Hz',
    },
  },
  {
    name: 'Lenovo ThinkPad E14 Gen 6 Ryzen 7',
    description: 'Laptop doanh nghiệp bền bỉ, bàn phím tốt.',
    price: 21990000,
    stock: 14,
    category: 'Laptop',
    brand: 'Lenovo',
    specs: {
      CPU: 'AMD Ryzen 7 7735HS',
      RAM: '16 GB',
      'Ổ cứng': '512 GB SSD',
      'Màn hình': '14 inch WUXGA',
      'Trọng lượng': '1,41 kg',
    },
  },
  {
    name: 'Lenovo Legion 5 15 RTX 4050',
    description: 'Laptop gaming tầm trung, màn hình tần số quét cao.',
    price: 26990000,
    stock: 0,
    category: 'Laptop',
    brand: 'Lenovo',
    specs: {
      CPU: 'AMD Ryzen 7 7840HS',
      GPU: 'RTX 4050 6GB',
      RAM: '16 GB',
      'Ổ cứng': '512 GB SSD',
      'Màn hình': '15.6 inch FHD 165Hz',
    },
  },

  // ---- Điện thoại ----
  {
    name: 'iPhone 16 128GB',
    description: 'Điện thoại Apple với chip mới và camera cải tiến.',
    price: 22990000,
    stock: 30,
    category: 'Điện thoại',
    brand: 'Apple',
    specs: {
      Chip: 'Apple A18',
      'Bộ nhớ': '128 GB',
      'Màn hình': '6.1 inch OLED',
      'Camera sau': '48 MP + 12 MP',
      Pin: '3561 mAh',
    },
  },
  {
    name: 'iPhone 16 Pro Max 256GB',
    description: 'Phiên bản cao cấp nhất, màn hình lớn, camera tele.',
    price: 34990000,
    stock: 10,
    category: 'Điện thoại',
    brand: 'Apple',
    specs: {
      Chip: 'Apple A18 Pro',
      'Bộ nhớ': '256 GB',
      'Màn hình': '6.9 inch OLED 120Hz',
      'Camera sau': '48 MP + 48 MP + 12 MP',
      Pin: '4685 mAh',
    },
  },
  {
    name: 'iPhone 15 128GB',
    description: 'Đời trước giá mềm hơn, cổng USB-C.',
    price: 17990000,
    stock: 20,
    category: 'Điện thoại',
    brand: 'Apple',
    specs: {
      Chip: 'Apple A16 Bionic',
      'Bộ nhớ': '128 GB',
      'Màn hình': '6.1 inch OLED',
      'Camera sau': '48 MP + 12 MP',
    },
  },
  {
    name: 'Samsung Galaxy S24 Ultra 256GB',
    description: 'Flagship Android với bút S Pen và camera zoom xa.',
    price: 28990000,
    stock: 11,
    category: 'Điện thoại',
    brand: 'Samsung',
    specs: {
      Chip: 'Snapdragon 8 Gen 3',
      'Bộ nhớ': '256 GB',
      RAM: '12 GB',
      'Màn hình': '6.8 inch AMOLED 120Hz',
      'Camera sau': '200 MP + 50 MP + 12 MP + 10 MP',
    },
  },
  {
    name: 'Samsung Galaxy S24 FE 128GB',
    description: 'Dòng flagship rút gọn, giá dễ tiếp cận.',
    price: 15990000,
    stock: 18,
    category: 'Điện thoại',
    brand: 'Samsung',
    specs: {
      Chip: 'Exynos 2400e',
      'Bộ nhớ': '128 GB',
      RAM: '8 GB',
      'Màn hình': '6.7 inch AMOLED 120Hz',
      Pin: '4700 mAh',
    },
  },
  {
    name: 'Samsung Galaxy A55 5G 8GB/256GB',
    description: 'Tầm trung khung kim loại, chống nước IP67.',
    price: 10990000,
    stock: 40,
    category: 'Điện thoại',
    brand: 'Samsung',
    specs: {
      Chip: 'Exynos 1480',
      RAM: '8 GB',
      'Bộ nhớ': '256 GB',
      'Màn hình': '6.6 inch Super AMOLED 120Hz',
      Pin: '5000 mAh',
    },
  },

  // ---- Máy tính bảng ----
  {
    name: 'iPad Air 11 inch M2 128GB Wi-Fi',
    description: 'Máy tính bảng mạnh mẽ, hỗ trợ Apple Pencil Pro.',
    price: 16990000,
    stock: 14,
    category: 'Máy tính bảng',
    brand: 'Apple',
    specs: {
      Chip: 'Apple M2',
      'Bộ nhớ': '128 GB',
      'Màn hình': '11 inch Liquid Retina',
      'Kết nối': 'Wi-Fi 6E',
    },
  },
  {
    name: 'iPad 10.9 inch Gen 10 64GB Wi-Fi',
    description: 'iPad phổ thông cho học tập và giải trí.',
    price: 9490000,
    stock: 28,
    category: 'Máy tính bảng',
    brand: 'Apple',
    specs: {
      Chip: 'Apple A14 Bionic',
      'Bộ nhớ': '64 GB',
      'Màn hình': '10.9 inch Liquid Retina',
      'Kết nối': 'Wi-Fi 6',
    },
  },
  {
    name: 'Samsung Galaxy Tab S9 FE 6GB/128GB',
    description: 'Máy tính bảng Android kèm bút S Pen, chống nước IP68.',
    price: 9990000,
    stock: 16,
    category: 'Máy tính bảng',
    brand: 'Samsung',
    specs: {
      Chip: 'Exynos 1380',
      RAM: '6 GB',
      'Bộ nhớ': '128 GB',
      'Màn hình': '10.9 inch TFT 90Hz',
      Pin: '8000 mAh',
    },
  },

  // ---- Âm thanh ----
  {
    name: 'AirPods Pro 2 USB-C',
    description: 'Tai nghe chống ồn chủ động, hộp sạc USB-C.',
    price: 5990000,
    stock: 35,
    category: 'Âm thanh',
    brand: 'Apple',
    specs: {
      'Chống ồn': 'Có (ANC)',
      'Kết nối': 'Bluetooth 5.3',
      'Thời lượng pin': 'Đến 6 giờ (30 giờ với hộp sạc)',
    },
  },
  {
    name: 'Samsung Galaxy Buds3 Pro',
    description: 'Tai nghe true wireless chống ồn, tối ưu cho Galaxy.',
    price: 4990000,
    stock: 21,
    category: 'Âm thanh',
    brand: 'Samsung',
    specs: {
      'Chống ồn': 'Có (ANC)',
      'Kết nối': 'Bluetooth 5.4',
      'Thời lượng pin': 'Đến 6 giờ (26 giờ với hộp sạc)',
    },
  },
  {
    name: 'Anker Soundcore Motion+ loa Bluetooth',
    description: 'Loa Bluetooth công suất 30W, chống nước IPX7.',
    price: 2290000,
    stock: 24,
    category: 'Âm thanh',
    brand: 'Anker',
    specs: {
      'Công suất': '30 W',
      'Kết nối': 'Bluetooth 5.0',
      'Chống nước': 'IPX7',
      'Thời lượng pin': 'Đến 12 giờ',
    },
  },

  // ---- Phụ kiện (1 sản phẩm ẩn) ----
  {
    name: 'Logitech MX Master 3S',
    description: 'Chuột không dây cao cấp cho công việc, cuộn siêu êm.',
    price: 2490000,
    stock: 33,
    category: 'Phụ kiện',
    brand: 'Logitech',
    specs: {
      'Kết nối': 'Bluetooth, Logi Bolt',
      'Độ phân giải': '8000 DPI',
      Pin: 'Đến 70 ngày',
    },
  },
  {
    name: 'Logitech MX Keys S',
    description: 'Bàn phím không dây phím thấp, đèn nền thông minh.',
    price: 2790000,
    stock: 20,
    category: 'Phụ kiện',
    brand: 'Logitech',
    specs: {
      'Kết nối': 'Bluetooth, Logi Bolt',
      Layout: 'Full-size',
      Pin: 'Đến 10 ngày (bật đèn nền)',
    },
  },
  {
    name: 'Anker Nano 3 củ sạc 30W',
    description: 'Củ sạc nhỏ gọn chuẩn GaN.',
    price: 590000,
    stock: 80,
    category: 'Phụ kiện',
    brand: 'Anker',
    specs: { 'Công suất': '30 W', Cổng: '1 USB-C', 'Công nghệ': 'GaN' },
  },
  {
    name: 'Cáp sạc Apple USB-C 1m',
    description: 'Cáp sạc và truyền dữ liệu USB-C chính hãng.',
    price: 390000,
    stock: 100,
    category: 'Phụ kiện',
    brand: 'Apple',
    specs: {
      'Chiều dài': '1 m',
      'Đầu nối': 'USB-C - USB-C',
      'Công suất tối đa': '60 W',
    },
  },
  {
    name: 'Samsung SSD T7 Portable 1TB',
    description: 'Ổ cứng di động SSD tốc độ cao, vỏ kim loại.',
    price: 2890000,
    stock: 23,
    category: 'Phụ kiện',
    brand: 'Samsung',
    specs: {
      'Dung lượng': '1 TB',
      'Tốc độ đọc': 'Đến 1050 MB/s',
      'Kết nối': 'USB 3.2 Gen 2',
    },
  },
  {
    name: 'Chuột Logitech M170 (ngừng kinh doanh)',
    description: 'Sản phẩm mẫu đã ẩn, dùng để thử chức năng ẩn/hiện.',
    price: 190000,
    stock: 5,
    category: 'Phụ kiện',
    brand: 'Logitech',
    specs: { 'Kết nối': 'USB receiver 2.4 GHz' },
    isActive: false,
  },
];
