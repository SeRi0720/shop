import {
  BRANDS_SCOPE,
  CATALOG_TTL,
  CATEGORIES_SCOPE,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  productListScope,
  productScope,
} from './product-cache';

describe('product-cache', () => {
  describe('productListScope', () => {
    it('có dạng products:<sha1 40 ký tự hex>', () => {
      expect(productListScope({})).toMatch(/^products:[0-9a-f]{40}$/);
    });

    it('cùng query khác thứ tự trường thì cùng khóa', () => {
      const a = productListScope({ q: 'mac', categoryId: 1, minPrice: 100 });
      const b = productListScope({ minPrice: 100, categoryId: 1, q: 'mac' });
      expect(a).toBe(b);
    });

    it('q có khoảng trắng đầu cuối thì cùng khóa', () => {
      expect(productListScope({ q: '  mac ' })).toBe(
        productListScope({ q: 'mac' }),
      );
    });

    it('q rỗng hoặc chỉ khoảng trắng giống như không có q', () => {
      expect(productListScope({ q: '   ' })).toBe(productListScope({}));
      expect(productListScope({ q: '' })).toBe(productListScope({}));
    });

    it('giá trị mặc định (page, limit, sort) giống như không gửi', () => {
      expect(
        productListScope({
          page: DEFAULT_PAGE,
          limit: DEFAULT_LIMIT,
          sort: 'newest',
        }),
      ).toBe(productListScope({}));
    });

    it('trường undefined giống như không có trường đó', () => {
      expect(productListScope({ categoryId: undefined })).toBe(
        productListScope({}),
      );
    });

    it.each([
      ['q', { q: 'iphone' }],
      ['categoryId', { categoryId: 2 }],
      ['brandId', { brandId: 2 }],
      ['minPrice', { minPrice: 1 }],
      ['maxPrice', { maxPrice: 1 }],
      ['sort', { sort: 'price_asc' as const }],
      ['page', { page: 2 }],
      ['limit', { limit: 24 }],
    ])('khác %s thì khác khóa', (_name, query) => {
      expect(productListScope(query)).not.toBe(productListScope({}));
    });

    it('minPrice=0 khác với không có minPrice (0 là giá trị thật)', () => {
      expect(productListScope({ minPrice: 0 })).not.toBe(productListScope({}));
    });

    it('minPrice và maxPrice không bị lẫn vào nhau', () => {
      expect(productListScope({ minPrice: 5 })).not.toBe(
        productListScope({ maxPrice: 5 }),
      );
    });
  });

  describe('hằng số', () => {
    it('productScope theo id', () => {
      expect(productScope(7)).toBe('product:7');
      expect(productScope(7)).not.toBe(productScope(8));
    });

    it('scope danh mục và thương hiệu khác nhau', () => {
      expect(CATEGORIES_SCOPE).not.toBe(BRANDS_SCOPE);
    });

    it('TTL: danh sách và chi tiết 60 giây, danh mục và thương hiệu 300 giây', () => {
      expect(CATALOG_TTL).toEqual({ list: 60, detail: 60, taxonomy: 300 });
    });

    it('mặc định phân trang khớp với giá trị cũ của ProductService (1 và 12)', () => {
      expect(DEFAULT_PAGE).toBe(1);
      expect(DEFAULT_LIMIT).toBe(12);
    });
  });
});
