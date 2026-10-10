import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CartService, problemOf } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

const product = (over: Record<string, unknown> = {}) => ({
  id: 5,
  name: 'MacBook',
  price: 1000,
  stock: 10,
  isActive: true,
  thumbnailUrl: null,
  ...over,
});

const makePrisma = () => ({
  cart: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ id: 1 }),
    findUniqueOrThrow: jest.fn(),
  },
  cartItem: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

const prismaError = (code: string) => Object.assign(new Error(code), { code });

describe('CartService', () => {
  let service: CartService;
  let prisma: ReturnType<typeof makePrisma>;
  let products: { findManyForCart: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    products = {
      findManyForCart: jest
        .fn()
        .mockImplementation((ids: number[]) =>
          Promise.resolve(ids.includes(5) ? [product()] : []),
        ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: products },
      ],
    }).compile();
    service = moduleRef.get(CartService);
  });

  describe('addItem', () => {
    it('thêm sản phẩm mới tạo dòng mới', async () => {
      await service.addItem(7, 5, 2);
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 1, productId: 5 } },
        update: { quantity: 2 },
        create: { cartId: 1, productId: 5, quantity: 2 },
      });
    });

    it('thêm lần hai cộng dồn số lượng', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({ quantity: 3 });
      await service.addItem(7, 5, 4);
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 7 } }),
      );
    });

    it('cộng dồn vượt tồn kho: 409, không ghi', async () => {
      products.findManyForCart.mockResolvedValue([product({ stock: 4 })]);
      prisma.cartItem.findUnique.mockResolvedValue({ quantity: 3 });
      await expect(service.addItem(7, 5, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('hết hàng (stock=0): 409', async () => {
      products.findManyForCart.mockResolvedValue([product({ stock: 0 })]);
      await expect(service.addItem(7, 5, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('cộng dồn vượt 10 cái mỗi dòng: 400, dù kho còn nhiều', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({ quantity: 8 });
      await expect(service.addItem(7, 5, 5)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('đúng 10 cái thì được (biên)', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({ quantity: 8 });
      await service.addItem(7, 5, 2);
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 10 } }),
      );
    });

    it('dòng thứ 21: 400; dòng thứ 20 thì được (biên)', async () => {
      prisma.cartItem.count.mockResolvedValue(20);
      await expect(service.addItem(7, 5, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();

      prisma.cartItem.count.mockResolvedValue(19);
      await service.addItem(7, 5, 1);
      expect(prisma.cartItem.upsert).toHaveBeenCalledTimes(1);
    });

    it('sản phẩm không tồn tại hoặc đang ẩn: 404, không tạo giỏ', async () => {
      products.findManyForCart.mockResolvedValue([]);
      await expect(service.addItem(7, 99, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      products.findManyForCart.mockResolvedValue([
        product({ isActive: false }),
      ]);
      await expect(service.addItem(7, 5, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.cart.upsert).not.toHaveBeenCalled();
    });

    it('P2002 khi tạo giỏ song song: đọc lại giỏ đã có và dùng id đó', async () => {
      prisma.cart.upsert.mockRejectedValue(prismaError('P2002'));
      prisma.cart.findUniqueOrThrow.mockResolvedValue({ id: 9 });
      await service.addItem(7, 5, 1);
      expect(prisma.cartItem.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cartId_productId: { cartId: 9, productId: 5 } },
        }),
      );
    });

    it('lỗi lạ khi tạo giỏ được ném lại nguyên vẹn', async () => {
      prisma.cart.upsert.mockRejectedValue(new Error('db down'));
      await expect(service.addItem(7, 5, 1)).rejects.toThrow('db down');
    });
  });

  describe('setQuantity', () => {
    it('dòng không có trong giỏ: 404', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await expect(service.setQuantity(7, 5, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('vượt tồn kho: 409; hợp lệ thì cập nhật đúng số lượng', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({ id: 11 });
      products.findManyForCart.mockResolvedValue([product({ stock: 4 })]);
      await expect(service.setQuantity(7, 5, 5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await service.setQuantity(7, 5, 4);
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: { quantity: 4 },
      });
    });

    it('dòng bị xóa giữa chừng (P2025): 404, không phải 500', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({ id: 11 });
      prisma.cartItem.update.mockRejectedValue(prismaError('P2025'));
      await expect(service.setQuantity(7, 5, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('removeItem', () => {
    it('xóa theo productId của đúng người dùng; dòng không có vẫn không lỗi', async () => {
      const cart = await service.removeItem(7, 5);
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { productId: 5, cart: { userId: 7 } },
      });
      expect(cart.items).toEqual([]);
    });
  });

  describe('getCart / cờ problem', () => {
    it('giá lấy từ sản phẩm hiện tại; tính tổng đúng', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        items: [{ productId: 5, quantity: 3 }],
      });
      products.findManyForCart.mockResolvedValue([product({ price: 2500 })]);
      const cart = await service.getCart(7);
      expect(cart).toMatchObject({
        totalQuantity: 3,
        totalAmount: 7500,
        hasProblem: false,
      });
      expect(cart.items[0]).toMatchObject({
        price: 2500,
        lineTotal: 7500,
        problem: null,
      });
    });

    it('hasProblem=true khi có dòng lỗi', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        items: [{ productId: 5, quantity: 3 }],
      });
      products.findManyForCart.mockResolvedValue([product({ stock: 2 })]);
      const cart = await service.getCart(7);
      expect(cart.items[0].problem).toBe('EXCEEDS_STOCK');
      expect(cart.hasProblem).toBe(true);
    });

    it('chưa có giỏ: trả giỏ rỗng', async () => {
      expect(await service.getCart(7)).toEqual({
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        hasProblem: false,
      });
    });

    it.each([
      [{ isActive: false, stock: 5 }, 1, 'HIDDEN'],
      [{ isActive: true, stock: 0 }, 1, 'OUT_OF_STOCK'],
      [{ isActive: true, stock: 2 }, 3, 'EXCEEDS_STOCK'],
      [{ isActive: true, stock: 3 }, 3, null],
    ])('problemOf(%j, %i) = %s', (p, qty, expected) => {
      expect(problemOf(p, qty)).toBe(expected);
    });
  });

  describe('AddCartItemDto', () => {
    const errorProps = async (plain: object) =>
      (await validate(plainToInstance(AddCartItemDto, plain))).map(
        (e) => e.property,
      );

    it('hợp lệ', async () => {
      expect(await errorProps({ productId: 1, quantity: 1 })).toEqual([]);
      expect(await errorProps({ productId: 1, quantity: 10 })).toEqual([]);
    });

    it.each([0, -1, 1.5, '2', 11, null])(
      'quantity=%p bị từ chối',
      async (q) => {
        expect(await errorProps({ productId: 1, quantity: q })).toContain(
          'quantity',
        );
      },
    );

    it.each([0, 1.5, '1', 2_147_483_648])(
      'productId=%p bị từ chối',
      async (id) => {
        expect(await errorProps({ productId: id, quantity: 1 })).toContain(
          'productId',
        );
      },
    );
  });
});
