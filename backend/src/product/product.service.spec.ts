import { Test } from '@nestjs/testing';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { FakeCacheStore } from '../redis/testing/fake-cache-store';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

const category = { id: 1, name: 'Laptop' };
const brand = { id: 2, name: 'Apple' };
const productRow = {
  id: 5,
  name: 'MacBook',
  description: null,
  price: 1000,
  stock: 3,
  specs: { RAM: '16 GB' },
  isActive: true,
  category,
  brand,
  images: [{ id: 1, url: '/api/uploads/a.jpg', sortOrder: 0 }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makePrisma = () => ({
  product: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: { count: jest.fn().mockResolvedValue(1) },
  brand: { count: jest.fn().mockResolvedValue(1) },
  $transaction: jest
    .fn()
    .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
});

const whereOf = (fn: jest.Mock) =>
  (fn.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

const errorsOn = async <T extends object>(
  cls: ClassConstructor<T>,
  plain: object,
  prop: string,
) =>
  (await validate(plainToInstance(cls, plain))).some(
    (e) => e.property === prop,
  );

const isValid = async <T extends object>(
  cls: ClassConstructor<T>,
  plain: object,
) => (await validate(plainToInstance(cls, plain))).length === 0;

describe('ProductService', () => {
  let service: ProductService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        // Không cache: các ca cũ kiểm đường đọc DB. Ca cache viết riêng (bước 7).
        { provide: CacheService, useValue: CacheService.disabled() },
      ],
    }).compile();
    service = moduleRef.get(ProductService);
  });

  describe('search', () => {
    it('dựng đúng where từ q, categoryId, brandId, khoảng giá; count và findMany dùng chung where', async () => {
      await service.search(
        {
          q: '50%',
          categoryId: 1,
          brandId: 2,
          minPrice: 1000,
          maxPrice: 5000,
          page: 2,
        },
        false,
      );
      const expectedWhere = {
        isActive: true,
        // escapeLike: ký tự % được thoát để không thành ký tự đại diện
        name: { contains: '50\\%', mode: 'insensitive' },
        categoryId: 1,
        brandId: 2,
        price: { gte: 1000, lte: 5000 },
      };
      expect(prisma.product.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, skip: 12, take: 12 }),
      );
      expect(whereOf(prisma.product.count)).toEqual(
        whereOf(prisma.product.findMany),
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('cắt khoảng trắng đầu/cuối của q', async () => {
      await service.search({ q: '  mac  ' }, false);
      expect(whereOf(prisma.product.count).name).toEqual({
        contains: 'mac',
        mode: 'insensitive',
      });
    });

    it('chỉ có minPrice thì không đặt chặn trên', async () => {
      await service.search({ minPrice: 100 }, false);
      expect(whereOf(prisma.product.count).price).toEqual({ gte: 100 });
    });

    it('includeHidden=false lọc isActive=true, includeHidden=true thì không lọc', async () => {
      await service.search({}, false);
      expect(whereOf(prisma.product.count).isActive).toBe(true);

      prisma.product.count.mockClear();
      await service.search({}, true);
      expect(whereOf(prisma.product.count).isActive).toBeUndefined();
    });

    it('minPrice > maxPrice bị từ chối, không truy vấn DB', async () => {
      await expect(
        service.search({ minPrice: 200, maxPrice: 100 }, false),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('minPrice = maxPrice được chấp nhận (biên)', async () => {
      await expect(
        service.search({ minPrice: 100, maxPrice: 100 }, false),
      ).resolves.toBeDefined();
    });

    it.each([
      ['newest', [{ createdAt: 'desc' }, { id: 'desc' }]],
      [undefined, [{ createdAt: 'desc' }, { id: 'desc' }]],
      ['price_asc', [{ price: 'asc' }, { id: 'desc' }]],
      ['price_desc', [{ price: 'desc' }, { id: 'desc' }]],
    ] as const)(
      'sort=%s có khóa phụ id để thứ tự ổn định',
      async (sort, orderBy) => {
        await service.search({ sort }, false);
        expect(prisma.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy }),
        );
      },
    );

    it('mặc định page=1, limit=12; tính totalPages đúng', async () => {
      prisma.product.count.mockResolvedValue(25);
      const res = await service.search({}, false);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 12 }),
      );
      expect(res).toMatchObject({
        total: 25,
        page: 1,
        limit: 12,
        totalPages: 3,
      });
    });

    it('không có kết quả: totalPages = 0', async () => {
      const res = await service.search({}, false);
      expect(res).toMatchObject({ items: [], total: 0, totalPages: 0 });
    });

    it('thumbnailUrl lấy ảnh đầu tiên, không có ảnh thì null', async () => {
      const base = {
        id: 1,
        name: 'A',
        price: 10,
        stock: 1,
        isActive: true,
        category,
        brand,
      };
      prisma.product.count.mockResolvedValue(2);
      prisma.product.findMany.mockResolvedValue([
        { ...base, images: [{ url: '/api/uploads/a.jpg' }] },
        { ...base, id: 2, images: [] },
      ]);
      const res = await service.search({}, false);
      expect(res.items.map((i) => i.thumbnailUrl)).toEqual([
        '/api/uploads/a.jpg',
        null,
      ]);
    });
  });

  describe('findOne', () => {
    it('khách: sản phẩm ẩn hoặc không có thì 404, truy vấn có isActive=true', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne(5, false)).rejects.toThrow(
        NotFoundException,
      );
      expect(whereOf(prisma.product.findFirst)).toEqual({
        id: 5,
        isActive: true,
      });
    });

    it('admin: không lọc isActive nên thấy được sản phẩm ẩn', async () => {
      prisma.product.findFirst.mockResolvedValue({
        ...productRow,
        isActive: false,
      });
      const res = await service.findOne(5, true);
      expect(whereOf(prisma.product.findFirst)).toEqual({ id: 5 });
      expect(res.isActive).toBe(false);
    });

    it('trả đủ danh mục, thương hiệu, ảnh, thông số', async () => {
      prisma.product.findFirst.mockResolvedValue(productRow);
      const res = await service.findOne(5, false);
      expect(res).toMatchObject({
        id: 5,
        name: 'MacBook',
        category,
        brand,
        specs: { RAM: '16 GB' },
        images: productRow.images,
      });
    });

    it('id vượt Int của Postgres: 404 và không gọi DB', async () => {
      await expect(service.findOne(2_147_483_648, false)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('id đúng bằng giá trị lớn nhất của Int thì vẫn truy vấn DB (biên)', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne(2_147_483_647, false)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'MacBook',
      price: 1000,
      stock: 3,
      categoryId: 1,
      brandId: 2,
    };

    it('danh mục không tồn tại: 400, không tạo sản phẩm', async () => {
      prisma.category.count.mockResolvedValue(0);
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('thương hiệu không tồn tại: 400, không tạo sản phẩm', async () => {
      prisma.brand.count.mockResolvedValue(0);
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('tạo thành công: specs mặc định {}, kiểm tra đúng id danh mục/thương hiệu', async () => {
      prisma.product.create.mockResolvedValue(productRow);
      const res = await service.create(dto);
      expect(prisma.category.count).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.brand.count).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'MacBook',
            specs: {},
            categoryId: 1,
            brandId: 2,
          }),
        }),
      );
      expect(res.id).toBe(5);
    });
  });

  describe('update', () => {
    it('sản phẩm không tồn tại: 404, không cập nhật', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.update(5, { price: 500 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('categoryId không tồn tại: 400, không cập nhật', async () => {
      prisma.product.findFirst.mockResolvedValue(productRow);
      prisma.category.count.mockResolvedValue(0);
      await expect(service.update(5, { categoryId: 99 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('không gửi categoryId/brandId thì không kiểm tra tham chiếu', async () => {
      prisma.product.findFirst.mockResolvedValue(productRow);
      prisma.product.update.mockResolvedValue(productRow);
      await service.update(5, { price: 500 });
      expect(prisma.category.count).not.toHaveBeenCalled();
      expect(prisma.brand.count).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 }, data: { price: 500 } }),
      );
    });

    it('ẩn sản phẩm bằng isActive=false (không xóa cứng)', async () => {
      prisma.product.findFirst.mockResolvedValue(productRow);
      prisma.product.update.mockResolvedValue({
        ...productRow,
        isActive: false,
      });
      const res = await service.update(5, { isActive: false });
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(res.isActive).toBe(false);
    });
  });

  describe('cache (đường đọc công khai)', () => {
    let store: FakeCacheStore;

    beforeEach(async () => {
      store = new FakeCacheStore();
      prisma = makePrisma();
      const moduleRef = await Test.createTestingModule({
        providers: [
          ProductService,
          { provide: PrismaService, useValue: prisma },
          { provide: CacheService, useValue: new CacheService(store) },
        ],
      }).compile();
      service = moduleRef.get(ProductService);
    });

    describe('search', () => {
      it('khách: lần hai trúng cache, không gọi Prisma lại', async () => {
        const first = await service.search({ q: 'mac' }, false);
        const second = await service.search({ q: 'mac' }, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.product.count).toHaveBeenCalledTimes(1);
        expect(second).toEqual(first);
      });

      it('cùng query khác thứ tự trường, q có khoảng trắng: dùng chung một khóa', async () => {
        await service.search({ q: 'mac', categoryId: 1 }, false);
        await service.search({ categoryId: 1, q: ' mac ' }, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      });

      it('query khác nhau thì không dùng chung kết quả', async () => {
        await service.search({ categoryId: 1 }, false);
        await service.search({ categoryId: 2 }, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
      });

      it('ghi TTL 60 giây cho danh sách', async () => {
        await service.search({}, false);
        const [key] = store.cacheKeys();
        expect(key).toMatch(/^cache:catalog:v0:products:[0-9a-f]{40}$/);
        expect(store.ttls.get(key)).toBe(60);
      });

      it('admin (includeHidden=true) không qua cache', async () => {
        await service.search({}, true);
        await service.search({}, true);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
        expect(store.cacheKeys()).toEqual([]);
      });

      it('minPrice > maxPrice: 400 và không chạm Redis', async () => {
        await expect(
          service.search({ minPrice: 200, maxPrice: 100 }, false),
        ).rejects.toThrow(BadRequestException);
        expect(store.gets).toHaveLength(0);
      });
    });

    describe('findOne', () => {
      it('khách: lần hai trúng cache, không gọi Prisma lại', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        const first = await service.findOne(5, false);
        const second = await service.findOne(5, false);
        expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
        expect(second).toMatchObject({
          id: 5,
          name: 'MacBook',
          category,
          brand,
        });
        expect(first.id).toBe(second.id);
      });

      it('ghi TTL 60 giây cho chi tiết', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        await service.findOne(5, false);
        expect(store.ttls.get('cache:catalog:v0:product:5')).toBe(60);
      });

      it('admin (includeHidden=true) không qua cache', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        await service.findOne(5, true);
        await service.findOne(5, true);
        expect(prisma.product.findFirst).toHaveBeenCalledTimes(2);
        expect(store.cacheKeys()).toEqual([]);
      });

      it('404 không được cache: mỗi lần đều hỏi DB', async () => {
        prisma.product.findFirst.mockResolvedValue(null);
        await expect(service.findOne(5, false)).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.findOne(5, false)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.product.findFirst).toHaveBeenCalledTimes(2);
        expect(store.cacheKeys()).toEqual([]);
      });

      it('id vượt Int: 404 và không chạm Redis', async () => {
        await expect(service.findOne(2_147_483_648, false)).rejects.toThrow(
          NotFoundException,
        );
        expect(store.gets).toHaveLength(0);
      });

      it('hạn chế đã biết: tồn kho hiển thị có thể trễ tới hết TTL', async () => {
        prisma.product.findFirst.mockResolvedValue({ ...productRow, stock: 3 });
        await service.findOne(5, false);
        prisma.product.findFirst.mockResolvedValue({ ...productRow, stock: 1 });
        const second = await service.findOne(5, false);
        expect(second.stock).toBe(3); // đặt đơn không bump; giỏ và đơn vẫn đọc DB
      });
    });

    describe('đường tồn kho không qua cache', () => {
      it('findManyForCart luôn đọc Prisma', async () => {
        await service.findManyForCart([5]);
        await service.findManyForCart([5]);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
        expect(store.cacheKeys()).toEqual([]);
        expect(store.gets).toHaveLength(0);
      });
    });

    describe('vô hiệu hóa sau khi ghi', () => {
      const dto = {
        name: 'MacBook',
        price: 1000,
        stock: 3,
        categoryId: 1,
        brandId: 2,
      };

      it('create: danh sách sau đó đọc lại DB', async () => {
        await service.search({}, false);
        prisma.product.create.mockResolvedValue(productRow);
        await service.create(dto);
        await service.search({}, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
      });

      it('update: danh sách và chi tiết sau đó đọc lại DB', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        prisma.product.update.mockResolvedValue(productRow);
        await service.search({}, false);
        await service.findOne(5, false);
        await service.update(5, { price: 500 });
        await service.search({}, false);
        await service.findOne(5, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
        // findFirst: 1 (findOne khách) + 1 (update gọi findOne admin) + 1 (findOne khách sau bump)
        expect(prisma.product.findFirst).toHaveBeenCalledTimes(3);
      });

      it('ẩn sản phẩm bằng update(isActive=false): khách thấy 404 ngay, không chờ hết TTL', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        await service.findOne(5, false); // vào cache
        prisma.product.update.mockResolvedValue({
          ...productRow,
          isActive: false,
        });
        await service.update(5, { isActive: false });
        prisma.product.findFirst.mockResolvedValue(null); // khách lọc isActive=true
        await expect(service.findOne(5, false)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('create lỗi (400): không bump, cache cũ còn nguyên', async () => {
        await service.search({}, false);
        prisma.category.count.mockResolvedValue(0);
        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
        await service.search({}, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      });

      it('update lỗi (404): không bump, cache cũ còn nguyên', async () => {
        await service.search({}, false);
        prisma.product.findFirst.mockResolvedValue(null);
        await expect(service.update(5, { price: 500 })).rejects.toThrow(
          NotFoundException,
        );
        await service.search({}, false);
        expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      });
    });

    describe('fail-open', () => {
      beforeEach(() => {
        jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        store.fail = true;
      });

      afterEach(() => jest.restoreAllMocks());

      it('Redis chết: search và findOne vẫn trả đúng, mỗi lần đọc DB', async () => {
        prisma.product.findFirst.mockResolvedValue(productRow);
        await expect(service.search({}, false)).resolves.toMatchObject({
          total: 0,
        });
        await service.search({}, false);
        await expect(service.findOne(5, false)).resolves.toMatchObject({
          id: 5,
        });
        expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
      });

      it('Redis chết: create và update vẫn thành công', async () => {
        prisma.product.create.mockResolvedValue(productRow);
        prisma.product.findFirst.mockResolvedValue(productRow);
        prisma.product.update.mockResolvedValue(productRow);
        await expect(
          service.create({
            name: 'MacBook',
            price: 1000,
            stock: 3,
            categoryId: 1,
            brandId: 2,
          }),
        ).resolves.toMatchObject({ id: 5 });
        await expect(service.update(5, { price: 500 })).resolves.toMatchObject({
          id: 5,
        });
      });
    });
  });

  describe('CreateProductDto', () => {
    const valid = {
      name: 'A',
      price: 1000,
      stock: 0,
      categoryId: 1,
      brandId: 2,
    };

    it('dữ liệu hợp lệ không có lỗi', async () => {
      expect(await isValid(CreateProductDto, valid)).toBe(true);
    });

    it.each([0, -5, 1.5, 2_000_000_001])(
      'price=%p bị từ chối',
      async (price) => {
        expect(
          await errorsOn(CreateProductDto, { ...valid, price }, 'price'),
        ).toBe(true);
      },
    );

    it('price=1 và price=2.000.000.000 được chấp nhận (biên)', async () => {
      expect(await isValid(CreateProductDto, { ...valid, price: 1 })).toBe(
        true,
      );
      expect(
        await isValid(CreateProductDto, { ...valid, price: 2_000_000_000 }),
      ).toBe(true);
    });

    it.each([-1, 1_000_001, 1.5])('stock=%p bị từ chối', async (stock) => {
      expect(
        await errorsOn(CreateProductDto, { ...valid, stock }, 'stock'),
      ).toBe(true);
    });

    it('stock=0 được chấp nhận (biên)', async () => {
      expect(await isValid(CreateProductDto, { ...valid, stock: 0 })).toBe(
        true,
      );
    });

    it('name: cắt khoảng trắng; chỉ toàn khoảng trắng hoặc quá 200 ký tự bị từ chối', async () => {
      expect(
        plainToInstance(CreateProductDto, { ...valid, name: '  A  ' }).name,
      ).toBe('A');
      expect(
        await errorsOn(CreateProductDto, { ...valid, name: '   ' }, 'name'),
      ).toBe(true);
      expect(
        await errorsOn(
          CreateProductDto,
          { ...valid, name: 'x'.repeat(201) },
          'name',
        ),
      ).toBe(true);
    });

    it('thiếu categoryId hoặc brandId bị từ chối', async () => {
      const { categoryId: _c, ...noCategory } = valid;
      const { brandId: _b, ...noBrand } = valid;
      expect(await errorsOn(CreateProductDto, noCategory, 'categoryId')).toBe(
        true,
      );
      expect(await errorsOn(CreateProductDto, noBrand, 'brandId')).toBe(true);
    });

    const pairs = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'v']));
    const badSpecs: [string, unknown][] = [
      ['giá trị không phải chuỗi', { RAM: 16 }],
      ['lồng nhau', { a: { b: 'c' } }],
      ['là mảng', ['x']],
      ['là chuỗi', 'abc'],
      ['khóa rỗng', { ' ': 'x' }],
      ['khóa quá 50 ký tự', { ['k'.repeat(51)]: 'v' }],
      ['giá trị quá 200 ký tự', { a: 'x'.repeat(201) }],
      ['quá 30 cặp', pairs(31)],
    ];

    it.each(badSpecs)('specs %s bị từ chối', async (_name, specs) => {
      expect(
        await errorsOn(CreateProductDto, { ...valid, specs }, 'specs'),
      ).toBe(true);
    });

    it('specs đúng 30 cặp, khóa 50 và giá trị 200 ký tự được chấp nhận (biên)', async () => {
      expect(
        await isValid(CreateProductDto, { ...valid, specs: pairs(30) }),
      ).toBe(true);
      expect(
        await isValid(CreateProductDto, {
          ...valid,
          specs: { ['k'.repeat(50)]: 'x'.repeat(200) },
        }),
      ).toBe(true);
    });

    it('không gửi specs vẫn hợp lệ', async () => {
      expect(await isValid(CreateProductDto, valid)).toBe(true);
    });
  });

  describe('UpdateProductDto', () => {
    it('gửi {} hợp lệ (mọi trường đều tùy chọn)', async () => {
      expect(await isValid(UpdateProductDto, {})).toBe(true);
    });

    it('vẫn áp dụng quy tắc của CreateProductDto: price=0 bị từ chối', async () => {
      expect(await errorsOn(UpdateProductDto, { price: 0 }, 'price')).toBe(
        true,
      );
    });

    it('isActive phải là boolean', async () => {
      expect(
        await errorsOn(UpdateProductDto, { isActive: 'yes' }, 'isActive'),
      ).toBe(true);
      expect(await isValid(UpdateProductDto, { isActive: false })).toBe(true);
    });
  });

  describe('ProductQueryDto', () => {
    it('query rỗng hợp lệ', async () => {
      expect(await isValid(ProductQueryDto, {})).toBe(true);
    });

    it('số dạng chuỗi trên query được chuyển thành number', () => {
      const dto = plainToInstance(ProductQueryDto, {
        page: '2',
        limit: '12',
        minPrice: '100',
      });
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(12);
      expect(dto.minPrice).toBe(100);
    });

    it('limit=51 bị từ chối, limit=50 được chấp nhận (biên)', async () => {
      expect(await errorsOn(ProductQueryDto, { limit: '51' }, 'limit')).toBe(
        true,
      );
      expect(await isValid(ProductQueryDto, { limit: '50' })).toBe(true);
    });

    it.each(['abc', '0', '-1'])('page=%p bị từ chối', async (page) => {
      expect(await errorsOn(ProductQueryDto, { page }, 'page')).toBe(true);
    });

    it('minPrice âm bị từ chối', async () => {
      expect(
        await errorsOn(ProductQueryDto, { minPrice: '-1' }, 'minPrice'),
      ).toBe(true);
    });

    it('sort chỉ nhận newest, price_asc, price_desc', async () => {
      expect(await errorsOn(ProductQueryDto, { sort: 'hack' }, 'sort')).toBe(
        true,
      );
      expect(await isValid(ProductQueryDto, { sort: 'price_asc' })).toBe(true);
    });

    it('q được cắt khoảng trắng, quá 100 ký tự bị từ chối', async () => {
      expect(plainToInstance(ProductQueryDto, { q: '  mac  ' }).q).toBe('mac');
      expect(await errorsOn(ProductQueryDto, { q: 'x'.repeat(101) }, 'q')).toBe(
        true,
      );
    });
  });
});
